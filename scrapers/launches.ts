import axios from 'axios';
import { JSDOM } from 'jsdom';
import { DateTime } from 'luxon';
import { config } from '../config';
import {
  RocketLaunchTimeType,
  RocketLaunchType,
} from '../types/databaseModels';
import {
  ScraperControllerType,
  ImpossibleRegexError,
  abbreviatedMonths,
  fullMonths,
} from '../types/globalTypes';
import {
  defaultLaunchPrototypeObject,
  getAffiliations,
  RocketLaunchDataReportType,
} from '../types/scraperLaunchTypes';

const seasonToMonth: Record<string, number> = {
  SPRING: 5,
  SUMMER: 8,
  FALL: 11,
  WINTER: 2,
};
const quarterToMonth: Record<string, number> = {
  '1ST': 3,
  '2ND': 6,
  '3RD': 9,
  '4TH': 12,
};
const regexps = {
  date: {
    abbreviatedMonthAndDay: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Oct|Nov|Dec)\. (\d\d?)/i,
    fullMonthAndDay: /(January|February|March|April|May|June|July|August|September|October|November|December) (\d\d?)/i,
    month: /(January|February|March|April|May|June|July|August|September|October|November|December)/i,
    quarter: /(1st|2nd|3rd|4th) Quarter/i,
    season: /(Spring|Summer|Fall|Winter)i/,
    year: /.+[ -](\d{4})/,
  },
  time: {
    standardTime: /^(\d\d)(\d\d) GMT/,
    standardTimeWithSeconds: /^(\d\d)(\d\d):(\d\d) GMT/,
    approximateTime: /(Approx\.|Approximately) (\d\d)(\d\d)(:\d\d)? GMT/,
    launchWindow: /./,
    launchWindowWithSeconds: /./,
    flexibleTime: /./,
  },
};

const stringToTimeObject = (rawDate: string, rawTime: string) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    // Step 1: Get a specific day to work with. For events which do not
    //         correspond to a specific day, like "Summer" or "3rd Quarter",
    //         we assign the day to the end of such a range. For example,
    //         "September" --> Month: September; Day: 30. We currently
    //         disregard temporal information like "Early"/"Late".
    const isDated = rawDate.indexOf('TBD') === -1;
    if (!isDated) { // No date, just return.
      return {
        type: RocketLaunchTimeType.UNDECIDED,
        isNET: false,
        startDate: 0,
        stopDate: null,
      };
    }
    const isNETDate = rawDate.indexOf('NET') > -1;
    let timeType = RocketLaunchTimeType.UNKNOWN;
    let year = currentYear;
    let day = -1;
    let month = -1;
    if (rawDate.match(regexps.date.abbreviatedMonthAndDay)) {
      const result = rawDate.match(regexps.date.abbreviatedMonthAndDay);
      if (!result || result.length < 3) {
        throw ImpossibleRegexError;
      }
      month = abbreviatedMonths.indexOf(result[1].toUpperCase());
      day = parseInt(result[2], 10);
      timeType = RocketLaunchTimeType.ESTIMATED;
    } else if (rawDate.match(regexps.date.fullMonthAndDay)) {
      const result = rawDate.match(regexps.date.fullMonthAndDay);
      if (!result || result.length < 3) {
        throw ImpossibleRegexError;
      }
      month = fullMonths.indexOf(result[1].toUpperCase());
      day = parseInt(result[2], 10);
      timeType = RocketLaunchTimeType.ESTIMATED;
    } else if (rawDate.match(regexps.date.month)) {
      const result = rawDate.match(regexps.date.month);
      if (!result || result.length < 2) {
        throw ImpossibleRegexError;
      }
      month = fullMonths.indexOf(result[1].toUpperCase());
      if (month < currentMonth) {
        year++;
      }
      day = DateTime.utc(year, month, 1).plus({
        day: -1,
        month: 1,
      }).day; // Get the last day of the month
      timeType = RocketLaunchTimeType.ESTIMATED;
    } else if (rawDate.match(regexps.date.season)) {
      const result = rawDate.match(regexps.date.season);
      if (!result || result.length < 2) {
        throw ImpossibleRegexError;
      }
      month = seasonToMonth[result[1].toUpperCase()];
      if (month < currentMonth) {
        year++;
      }
      day = DateTime.utc(year, month, 1).plus({
        day: -1,
        month: 1,
      }).day; // Get the last day of the month
      timeType = RocketLaunchTimeType.ESTIMATED;
    } else if (rawDate.match(regexps.date.quarter)) {
      const result = rawDate.match(regexps.date.quarter);
      if (!result || result.length < 2) {
        throw ImpossibleRegexError;
      }
      month = quarterToMonth[result[1].toUpperCase()];
      if (month < currentMonth) {
        year++;
      }
      day = DateTime.utc(year, month, 1).plus({
        day: -1,
        month: 1,
      }).day; // Get the last day of the month
      timeType = RocketLaunchTimeType.ESTIMATED;
    } else if (rawDate.match(regexps.date.year)) {
      const result = rawDate.match(regexps.date.year);
      if (!result || result.length < 2) {
        throw ImpossibleRegexError;
      }
      year = parseInt(result[1], 10);
      month = 12;
      day = 31;
      timeType = RocketLaunchTimeType.ESTIMATED;
    }
    if (day === -1 || month === -1) {
      throw new Error('Failed to parse day/month from date');
    }

    // Step 2: Get a specific time or window to work with
    const isTimed = rawTime.indexOf('TBD') === -1;
    if (!isTimed) {
      return {
        type: RocketLaunchTimeType.ESTIMATED,
        isNET: isNETDate,
        startDate: DateTime.utc(
          2022,
          month,
          day,
        ).toUnixInteger(),
        stopDate: null,
      };
    }
    let hour = -1;
    let minute = -1;
    let second: number | null = null;
    if (rawTime.match(regexps.time.standardTime)) {
      const result = rawTime.match(regexps.time.standardTime);
      if (!result || result.length < 3) {
        throw new Error('Impressible regex condition');
      }
      hour = parseInt(result[1], 10);
      minute = parseInt(result[2], 10);
      timeType = RocketLaunchTimeType.EXACT;
    } else if (rawTime.match(regexps.time.standardTimeWithSeconds)) {
      const result = rawTime.match(regexps.time.standardTimeWithSeconds);
      if (!result || result.length < 4) {
        throw ImpossibleRegexError;
      }
      hour = parseInt(result[1], 10);
      minute = parseInt(result[2], 10);
      second = parseInt(result[3], 10);
    } else if (rawTime.match(regexps.time.approximateTime)) {
      const result = rawTime.match(regexps.time.approximateTime);
      if (!result || result.length < 4) {
        throw ImpossibleRegexError;
      }
      hour = parseInt(result[2], 10);
      minute = parseInt(result[3], 10);
      second = result[4] ? parseInt(result[3], 10) : null;
      timeType = RocketLaunchTimeType.APPROXIMATE;
    }
    return {
      type: timeType,
      isNET: isNETDate,
      startDate: DateTime.utc(
        2022,
        month,
        day,
        hour,
        minute,
        second || 0,
      ).toUnixInteger(),
      stopDate: null,
    };
  } catch (error) {
    console.error(error);
    return {
      type: RocketLaunchTimeType.UNKNOWN,
      isNET: false,
      startDate: 0,
      stopDate: null,
    };
  }
};

const collect = async () : Promise<RocketLaunchDataReportType> => {
  try {
    const { data: parsedResult } = await axios.get(config.scrapers.launches.url);
    const dom = new JSDOM(parsedResult);
    const containers = dom.window.document.getElementsByClassName('entry-content clearfix');
    if (containers.length !== 1) {
      throw new Error('Unexpected content container count in launch scraper');
    }
    const dateContainers = containers[0].getElementsByClassName('datename');
    const dataContainers = containers[0].getElementsByClassName('missiondata');
    const descriptionContainers = containers[0].getElementsByClassName('missdescrip');
    if (!(
      dateContainers.length === dataContainers.length
      && dateContainers.length === descriptionContainers.length
    )) {
      throw new Error('Launch component container size mismatch in launch scraper');
    }
    const launches: RocketLaunchType[] = [];
    for (let i = 0; i < dateContainers.length; i++) {
      const dateContainer = dateContainers[i];
      const dataContainer = dataContainers[i];
      const descriptionContainer = descriptionContainers[i];
      const launchPrototype = { ...defaultLaunchPrototypeObject };
      // Date, vehicle, and mission are in dateContainer
      const splitDate = dateContainer.getElementsByTagName('span');
      if (splitDate.length !== 2) {
        throw new Error(`Unexpected contents in dateContainer ${i} (${dateContainer.textContent})`);
      }
      launchPrototype.date = splitDate[0].textContent;
      [launchPrototype.vehicle, launchPrototype.mission] = (splitDate[1].textContent || ' • ').split(' • ');

      // Launch time, launch site are in dataContainer
      const splitData = (dataContainer.textContent || '').split('\n');
      if (splitData.length !== 2) {
        throw new Error(`Unexpected contents in dataContainer ${i} (${dataContainer.textContent})`);
      }
      const rawLaunchTime = splitData[0];
      const rawLaunchLocation = splitData[1];
      if (
        rawLaunchTime === null
        || rawLaunchLocation === null
        || !rawLaunchTime.match(/^Launch (time|window): .+$/)
        || !rawLaunchLocation.match(/^Launch site: .+$/)
      ) {
        throw new Error(`Unexpected format in launch data ${i} ${dataContainer.textContent}`);
      }
      launchPrototype.timeData = rawLaunchTime.substring(
        rawLaunchTime.indexOf('window') === 7 ? 15 : 13,
      );
      launchPrototype.launchSite = rawLaunchLocation.substring(13);

      // Affiliations, description are in the descriptionContainer
      launchPrototype.affiliations = getAffiliations(descriptionContainer.textContent || '');
      launchPrototype.description = descriptionContainer.textContent;

      if (!Object.values(launchPrototype).includes(null)) {
        launches.push({
          affiliations: launchPrototype.affiliations || [],
          date: launchPrototype.date || '',
          description: launchPrototype.description || '',
          launchSite: launchPrototype.launchSite || '',
          mission: launchPrototype.mission || '',
          time: stringToTimeObject(launchPrototype.date || '', launchPrototype.timeData),
          vehicle: launchPrototype.vehicle || '',
        });
      }
    }
    // Comment this out when working on handling new formats
    // console.log(
    //   launches
    //     .filter((launch) => launch.time.type === RocketLaunchTimeType.UNKNOWN)
    //     .map((launch) => [launch.mission, launch.time]),
    // );
    return {
      success: true,
      data: launches,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      data: null,
    };
  }
};

const mergeToDatabase = async (data: RocketLaunchDataReportType) : Promise<boolean> => {
  console.log(data);
  return false;
};

export default {
  collect,
  mergeToDatabase,
} as ScraperControllerType;
