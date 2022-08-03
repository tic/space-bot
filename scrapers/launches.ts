import axios from 'axios';
import { EmbedAuthorData, MessageEmbed } from 'discord.js';
import { JSDOM } from 'jsdom';
import { DateTime } from 'luxon';
import { config } from '../config';
import {
  collections,
  createBulkWriteArray,
} from '../services/database.service';
import { announce } from '../services/discord.service';
import { logError } from '../services/logger.service';
import { unixTimeToBoosterDate } from '../services/util';
import {
  Falcon9BoosterType,
  RocketLaunchTimeType,
  RocketLaunchType,
} from '../types/databaseModels';
import {
  ScraperControllerType,
  ImpossibleRegexError,
  abbreviatedMonths,
  fullMonths,
  ChangeReport,
  ChangeReportTypeEnum,
} from '../types/globalTypes';
import { BoosterTypeToString } from '../types/scraperBoosterTypes';
import {
  defaultLaunchPrototypeObject,
  getAffiliations,
  RocketLaunchDataReportType,
} from '../types/scraperLaunchTypes';
import { ChannelClassEnum } from '../types/serviceDiscordTypes';
import { LogCategoriesEnum } from '../types/serviceLoggerTypes';

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
    season: /(Spring|Summer|Fall|Winter)/i,
    year: /.+[ -](\d{4})/,
  },
  time: {
    standardTime: /^(\d\d)(\d\d) GMT/,
    standardTimeWithSeconds: /^(\d\d)(\d\d):(\d\d) GMT/,
    approximateTime: /(Approx\.|Approximately) (\d\d)(\d\d)(:\d\d)? GMT/,
    launchWindow: /(\d\d)(\d\d)-(\d\d)(\d\d) GMT/,
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
      throw new Error(`Failed to parse day/month from date: ${rawDate}, ${rawTime}`);
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
    let stopDate: number | null = null;
    if (rawTime.match(regexps.time.standardTime)) {
      const result = rawTime.match(regexps.time.standardTime);
      if (!result || result.length < 3) {
        throw ImpossibleRegexError;
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
    } else if (rawTime.match(regexps.time.launchWindow)) {
      const result = rawTime.match(regexps.time.launchWindow);
      if (!result || result.length < 5) {
        throw ImpossibleRegexError;
      }
      hour = parseInt(result[1], 10);
      minute = parseInt(result[2], 10);
      const stopHour = parseInt(result[3], 10);
      const stopMinute = parseInt(result[4], 10);
      stopDate = DateTime.utc(
        year,
        month,
        day,
        stopHour,
        stopMinute,
      ).plus({
        days: stopHour < hour ? 1 : 0,
      }).toUnixInteger();
      timeType = RocketLaunchTimeType.WINDOW;
    }
    if (hour === -1 || minute === -1) {
      throw new Error(`Failed to parse minute/second from date: ${rawDate}, ${rawTime}`);
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
      stopDate,
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
          mission: launchPrototype.mission || '',
          affiliations: launchPrototype.affiliations || [],
          date: launchPrototype.date || '',
          description: launchPrototype.description || '',
          launchSite: launchPrototype.launchSite || '',
          time: stringToTimeObject(launchPrototype.date || '', launchPrototype.timeData),
          vehicle: launchPrototype.vehicle || '',
        });
      }
    }
    // Comment this out when working on handling new formats
    // console.log(
    //   launches
    //     .filter((launch) => launch.time.type === RocketLaunchTimeType.WINDOW)
    //     .map((launch) => [launch.mission, launch.time]),
    // );
    // return {
    //   success: true,
    //   data: [],
    // }
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

const mergeToDatabase = async (report: RocketLaunchDataReportType) : Promise<ChangeReport> => {
  if (!report.success || report.data === null) {
    return {
      success: false,
      changes: null,
    };
  }
  try {
    if (report.data.length === 0) {
      return {
        success: true,
        changes: [],
      };
    }
    const { bulkWriteArray, changeItems } = await createBulkWriteArray(
      collections.launches,
      { $or: report.data.map((launchData) => ({ mission: launchData.mission })) },
      report,
      (currentDbItem: RocketLaunchType) => (
        testDbItem: RocketLaunchType,
      ) => currentDbItem.mission === testDbItem.mission,
      (dbItem: RocketLaunchType) => ({ mission: dbItem.mission }),
    );
    if (bulkWriteArray.length === 0) {
      return {
        success: true,
        changes: [],
      };
    }
    const result = await collections.launches.bulkWrite(bulkWriteArray);
    if (result.upsertedCount + result.modifiedCount !== bulkWriteArray.length) {
      return {
        success: false,
        changes: null,
      };
    }
    return {
      success: true,
      changes: changeItems,
    };
  } catch (error) {
    logError(LogCategoriesEnum.DB_MERGE_FAILURE, 'scraper_launches', String(error));
    return {
      success: false,
      changes: null,
    };
  }
};

const formatLaunchTime = ({ time }: RocketLaunchType) => {
  const prefix = time.isNET ? 'NET' : '';
  if (time.type === RocketLaunchTimeType.APPROXIMATE) {
    return `${prefix} Approximately <t:${time.startDate}:F>`;
  }
  if (time.type === RocketLaunchTimeType.ESTIMATED) {
    return `${prefix} <t:${time.startDate}:F> (estimated)`;
  }
  if (time.type === RocketLaunchTimeType.EXACT) {
    return `${prefix} <t:${time.startDate}:F>`;
  }
  if (time.type === RocketLaunchTimeType.EXACT_SECOND) {
    return `${prefix} <t:${time.startDate}:F>`;
  }
  if (time.type === RocketLaunchTimeType.EXACT_SECOND_WINDOW) {
    return `${prefix} Window opens: <t:${time.startDate}:F>\nWindow closes: <t:${time.stopDate}:F>`;
  }
  if (time.type === RocketLaunchTimeType.FLEXIBLE) {
    return `${prefix} Opportunity A: <t:${time.startDate}:F>\nOpportunity B: <t:${time.stopDate}:F>`;
  }
  if (time.type === RocketLaunchTimeType.UNDECIDED) {
    return 'TBD';
  }
  if (time.type === RocketLaunchTimeType.WINDOW) {
    return `${prefix} Window opens: <t:${time.startDate}:F>\nWindow closes: <t:${time.stopDate}:F>`;
  }
  return 'TBD';
};

const handleChanges = async (report: ChangeReport) => {
  if (!report.success || !report.changes || report.changes.length === 0) {
    return;
  }
  report.changes.forEach(async (changeItem) => {
    const newData = changeItem.data as RocketLaunchType;
    const oldData = changeItem.data as RocketLaunchType;
    const boosters = newData.vehicle === 'Falcon 9' || newData.vehicle === 'Falcon Heavy'
      ? await collections.boosters.find({
        assignments: { $elemMatch: { date: unixTimeToBoosterDate(newData.time.startDate) } },
      }).toArray() as Falcon9BoosterType[]
      : [];
    let embed: MessageEmbed | null = null;
    if (changeItem.changeType === ChangeReportTypeEnum.NEW) {
      embed = new MessageEmbed()
        .setColor('#ff0000')
        .setTitle(`${newData.vehicle} ● ${newData.mission}`)
        .setURL('https://spaceflightnow.com/launch-schedule/')
        .setAuthor({
          name: 'New Launch Posted! | SpaceflightNow',
          iconUrl: 'https://i.gyazo.com/bbfc6b20b64ac0db894f112e14a58cd5.jpg',
          url: 'https://spaceflightnow.com/',
        } as EmbedAuthorData)
        .setDescription(newData.description)
        .addFields(
          {
            name: 'Launch Time',
            value: formatLaunchTime(newData),
            inline: true,
          },
          {
            name: 'Launch Site',
            value: newData.launchSite,
            inline: false,
          },
        )
        .setTimestamp();
    } else if (changeItem.changeType === ChangeReportTypeEnum.UPDATED) {
      const oldTimeDisplay = formatLaunchTime(oldData);
      const newTimeDisplay = formatLaunchTime(newData);
      if (oldTimeDisplay === newTimeDisplay) {
        return;
      }
      embed = new MessageEmbed()
        .setColor('#ffff00')
        .setTitle(`${newData.vehicle} ● ${newData.mission}`)
        .setURL('https://spaceflightnow.com/launch-schedule/')
        .setAuthor({
          name: 'Launch Update! | SpaceflightNow',
          iconURL: 'https://i.gyazo.com/bbfc6b20b64ac0db894f112e14a58cd5.jpg',
          url: 'https://spaceflightnow.com/',
        } as EmbedAuthorData)
        .setDescription(newData.description)
        .addFields(
          {
            name: 'Launch Time',
            value: oldTimeDisplay === newTimeDisplay
              ? newTimeDisplay
              : `~~${oldTimeDisplay}~~\n${newTimeDisplay}`,
            inline: true,
          },
          {
            name: 'Launch Site',
            value: oldData.launchSite === newData.launchSite
              ? newData.launchSite
              : `~~${oldData.launchSite}~~\n${newData.launchSite}`,
            inline: false,
          },
        )
        .setTimestamp();
    }
    if (embed && boosters.length > 0) {
      boosters.forEach((booster) => {
        const currentAssignment = booster.assignments[booster.assignments.length - 1];
        const details = [
          `- Flight no. ${booster.assignments.length}`,
          currentAssignment.recoveryDetails.attempted
            ? `- Landing site: ${currentAssignment.recoveryDetails.location}`
            : '- Expendable -- no landing attempt',
        ];
        embed?.addField(
          `Booster ${booster.boosterSN} ${BoosterTypeToString[booster.currentClassification]}`,
          details.join('\n'),
          false,
        );
      });
    } else if (!embed) {
      return;
    }
    const result = await announce(
      ChannelClassEnum.CLOSURE_UPDATE,
      undefined,
      embed,
      [],
    );
    if (result === false) {
      logError(LogCategoriesEnum.ANNOUNCE_FAILURE, 'scraper_launches', 'failed to announce launch update');
    }
  });
};

export default {
  collect,
  mergeToDatabase,
  handleChanges,
} as ScraperControllerType;
