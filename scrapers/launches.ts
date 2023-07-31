/* eslint-disable no-await-in-loop */
import axios from 'axios';
import {
  EmbedAuthorData,
  MessageEmbed,
} from 'discord.js';
import { JSDOM } from 'jsdom';
import { DateTime } from 'luxon';
import { config } from '../config';
import {
  collections,
  createBulkWriteArray,
} from '../services/database.service';
import { announce } from '../services/discord.service';
import { logError, logMessage } from '../services/logger.service';
import { ExtendedTimeout, unixTimeToBoosterDate } from '../services/util';
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
  getAffiliations,
  RocketLaunchDataReportType,
  seasonToMonth,
  quarterToMonth,
  regexps,
  pendingLaunchReminders,
  launchReminderLock,
} from '../types/scraperLaunchTypes';
import { ChannelClassEnum } from '../types/serviceDiscordTypes';
import { LogCategoriesEnum } from '../types/serviceLoggerTypes';

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
        sortDate: 0,
      };
    }

    const isNETDate = rawDate.indexOf('NET') > -1;
    let timeType = RocketLaunchTimeType.UNKNOWN;
    let year = currentYear;
    let day = -1;
    let month = -1;

    let sortYear = currentYear;
    let sortDay = -1;
    let sortMonth = -1;

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
      sortMonth = month;
      if (month < currentMonth) {
        year++;
        sortYear++;
      }

      day = 1;

      // Get the last day of the month
      ({ day: sortDay } = DateTime.utc(year, month, 1).plus({
        day: -1,
        month: 1,
      }));

      timeType = RocketLaunchTimeType.ESTIMATED;
    } else if (rawDate.match(regexps.date.season)) {
      const result = rawDate.match(regexps.date.season);
      if (!result || result.length < 2) {
        throw ImpossibleRegexError;
      }

      month = seasonToMonth[result[1].toUpperCase()];
      sortMonth = month;
      if (month < currentMonth) {
        year++;
        sortYear++;
      }

      day = 1;

      // Get the last day of the month
      ({ day: sortDay } = DateTime.utc(year, month, 1).plus({
        day: -1,
        month: 1,
      }));

      timeType = RocketLaunchTimeType.ESTIMATED;
    } else if (rawDate.match(regexps.date.quarter)) {
      const result = rawDate.match(regexps.date.quarter);
      if (!result || result.length < 2) {
        throw ImpossibleRegexError;
      }

      month = quarterToMonth[result[1].toUpperCase()];
      sortMonth = month;
      if (month < currentMonth) {
        year++;
        sortYear++;
      }

      day = 1;

      // Get the last day of the month
      ({ day: sortDay } = DateTime.utc(year, month, 1).plus({
        day: -1,
        month: 1,
      }));

      timeType = RocketLaunchTimeType.ESTIMATED;
    } else if (rawDate.match(regexps.date.year)) {
      const result = rawDate.match(regexps.date.year);
      if (!result || result.length < 2) {
        throw ImpossibleRegexError;
      }

      year = parseInt(result[1], 10);
      sortYear = year;

      sortMonth = 1;
      month = 12;

      sortDay = 1;
      day = 31;

      timeType = RocketLaunchTimeType.ESTIMATED;
    }

    if (day === -1 || month === -1) {
      throw new Error(`Failed to parse day/month from date: ${rawDate}, ${rawTime}`);
    }

    // Step 2: Get a specific time or window to work with
    const isTimed = rawTime.indexOf('TBD') === -1;
    if (!isTimed) {
      const datetime = DateTime.utc(
        year,
        month,
        day,
        12,
        0,
        0,
      ).toMillis();

      return {
        type: RocketLaunchTimeType.ESTIMATED,
        isNET: isNETDate,
        startDate: datetime,
        stopDate: null,
        sortDate: sortDay === -1 ? datetime : DateTime.utc(
          sortYear,
          sortMonth,
          sortDay,
          23,
          59,
          59,
        ).toMillis(),
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
      }).toMillis();

      timeType = RocketLaunchTimeType.WINDOW;
    }
    if (hour === -1 || minute === -1) {
      throw new Error(`Failed to parse minute/second from date: ${rawDate}, ${rawTime}`);
    }

    const finalStartDate = DateTime.utc(
      year,
      month,
      day,
      hour,
      minute,
      second || 0,
    ).toMillis();

    // Some estimates provide a different date to sort by. If that's the
    // case, use the sort date instead of the start date.
    const finalSortDate = sortDay === -1 ? finalStartDate : DateTime.utc(
      sortYear,
      sortMonth,
      sortDay,
      23,
      59,
      59,
    ).toMillis();

    return {
      type: timeType,
      isNET: isNETDate,
      startDate: finalStartDate,
      stopDate,
      sortDate: finalSortDate,
    };
  } catch (error) {
    console.error(error);
    return {
      type: RocketLaunchTimeType.UNKNOWN,
      isNET: false,
      startDate: 0,
      stopDate: null,
      sortDate: 0,
    };
  }
};

const formatLaunchTime = ({ time }: RocketLaunchType) => {
  const prefix = time.isNET ? 'NET' : '';
  if (time.type === RocketLaunchTimeType.APPROXIMATE) {
    return `${prefix} Approximately <t:${Math.floor(time.startDate / 1000)}:F>`;
  }

  if (time.type === RocketLaunchTimeType.ESTIMATED) {
    return `${prefix} <t:${Math.floor(time.startDate / 1000)}:D> (estimated)`;
  }

  if (time.type === RocketLaunchTimeType.EXACT) {
    return `${prefix} <t:${Math.floor(time.startDate / 1000)}:F>`;
  }

  if (time.type === RocketLaunchTimeType.EXACT_SECOND) {
    return `${prefix} <t:${Math.floor(time.startDate / 1000)}:F>`;
  }

  if (time.type === RocketLaunchTimeType.EXACT_SECOND_WINDOW) {
    return `${prefix} Window opens: <t:${
      Math.floor(time.startDate / 1000)
    }:F>\nWindow closes: <t:${
      Math.floor(time.stopDate / 1000)
    }:F>`;
  }

  if (time.type === RocketLaunchTimeType.FLEXIBLE) {
    return `${prefix} Opportunity A: <t:${
      Math.floor(time.startDate / 1000)
    }:F>\nOpportunity B: <t:${
      Math.floor(time.stopDate / 1000)
    }:F>`;
  }

  if (time.type === RocketLaunchTimeType.UNDECIDED) {
    return 'TBD';
  }

  if (time.type === RocketLaunchTimeType.WINDOW) {
    return `${prefix} Window opens: <t:${
      Math.floor(time.startDate / 1000)
    }:F>\nWindow closes: <t:${
      Math.floor(time.stopDate / 1000)
    }:F>`;
  }

  return 'TBD';
};

const handleLaunchUpdate = async (launchData: RocketLaunchType, boosters: Falcon9BoosterType[]) => {
  const release = await launchReminderLock.acquire();
  try {
    if (pendingLaunchReminders[launchData.mission]) {
      pendingLaunchReminders[launchData.mission].forEach((item) => {
        if (item) {
          item.clear();
        }
      });

      delete pendingLaunchReminders[launchData.mission];
    }

    const timeUntilStart = launchData.time.startDate - new Date().getTime();
    if (
      launchData.time.type !== RocketLaunchTimeType.ESTIMATED
      && launchData.time.startDate
      && timeUntilStart > 3600000
    ) {
      const embeds = ['24', '1'].map((content) => new MessageEmbed()
        .setColor('#f70062')
        .setTitle(`${launchData.vehicle} ● ${launchData.mission}`)
        .setAuthor({
          name: `L-${content}h Reminder!`,
          iconURL: 'https://i.gyazo.com/bbfc6b20b64ac0db894f112e14a58cd5.jpg',
        })
        .setDescription(launchData.description)
        .addFields(
          { name: 'Launch Time', value: formatLaunchTime(launchData), inline: true },
          { name: 'Launch Site', value: launchData.launchSite, inline: false },
        )
        .setTimestamp());
      if (boosters.length > 0) {
        embeds.forEach((embed) => {
          boosters.forEach((booster) => {
            const currentAssignmentIndex = booster.assignments.findIndex(
              (assignment) => assignment.date === unixTimeToBoosterDate(launchData.time.startDate),
            );

            const currentAssignment = booster.assignments[currentAssignmentIndex];
            const details = [
              `- Flight no. ${currentAssignmentIndex + 1}`,
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
        });
      }

      const timeUntilFirstReminder = timeUntilStart - 86400000;
      const timeUntilSecondReminder = timeUntilStart - 3600000;
      const timeoutIdentifier = `launch_${launchData.mission}`;
      pendingLaunchReminders[launchData.mission] = [
        timeUntilFirstReminder > 0
          ? new ExtendedTimeout(
            timeUntilFirstReminder,
            () => {
              announce(
                ChannelClassEnum.LAUNCH_REMINDER,
                'Launch Notice',
                embeds[0],
                ['LAUNCH', ...launchData.affiliations],
              );
            },
            timeoutIdentifier,
          )
          : undefined,
        timeUntilSecondReminder > 0
          ? new ExtendedTimeout(
            timeUntilSecondReminder,
            () => {
              announce(
                ChannelClassEnum.LAUNCH_REMINDER,
                '**Launch Alert**',
                embeds[1],
                ['LAUNCH', ...launchData.affiliations],
              );
            },
            timeoutIdentifier,
          )
          : undefined,
      ];
    }
  } finally {
    release();
  }
};

const registerInitialLaunchTimeouts = async () => {
  const release = await launchReminderLock.acquire();
  try {
    logMessage(config.scrapers.launches.identifier, 'registering existing launch timeouts');
    const pendingReminders = await collections.launches.find(
      {
        'time.timeType': { $ne: RocketLaunchTimeType.ESTIMATED },
        'time.startDate': {
          $gt: new Date().getTime() + 3600000,
          $ne: 0,
        },
      },
    ).toArray() as (null | RocketLaunchType[]);
    if (Array.isArray(pendingReminders)) {
      pendingReminders.forEach(async (launchData) => {
        const boosters = launchData.vehicle === 'Falcon 9' || launchData.vehicle === 'Falcon Heavy'
          ? await collections.boosters.find({
            'assignments.date': unixTimeToBoosterDate(launchData.time.sortDate),
          }).toArray() as Falcon9BoosterType[]
          : [];
        handleLaunchUpdate(launchData, boosters);
      });
    }
    logMessage(config.scrapers.launches.identifier, 'existing timeouts registered');
  } catch (error) {
    logError(LogCategoriesEnum.STATUS_LOG, config.scrapers.launches.identifier, String(error));
  } finally {
    release();
  }
};

const collect = async () : Promise<RocketLaunchDataReportType> => {
  try {
    const { data: parsedResult } = await axios.get(config.scrapers.launches.url);
    const dom = new JSDOM(parsedResult);
    const cards = dom.window.document.getElementsByClassName('launch');
    const launches: RocketLaunchType[] = [];

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const [vehicle, mission] = card.getElementsByTagName('h5')[0].textContent.split(' | ').map((itme) => itme.trim());
      if (mission.match(/unknown payload/i)) {
        continue;
      }

      const [datetimeRaw, launchSite] = card
        .getElementsByClassName('mdl-card__supporting-text')[0]
        .textContent
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      const splitPoint = datetimeRaw.search(/\d{4}/);
      const rawDate = datetimeRaw.substring(0, splitPoint).replace(/(Sun)|(Mon)|(Tue)|(Wed)|(Thu)|(Fri)|(Sat)/, '');
      const rawTime = datetimeRaw.substring(splitPoint + 4).replace(':', '').trim();
      const rawAffiliations = [card.getElementsByTagName('span')[0].textContent.trim()];
      const timeObj = stringToTimeObject(rawDate, rawTime || 'TBD');

      const detailsUrl = card.getElementsByTagName('button')[0].getAttribute('onclick').slice(27, -1);

      logMessage('scraper_launches', `running subrequest for mission ${mission}`);
      const { data: parsedDetailsResult } = await axios.get(`${config.scrapers.launches.url}${detailsUrl}`);
      const detailDom = new JSDOM(parsedDetailsResult);

      const sectionHeaders = detailDom.window.document.getElementsByTagName('h3');
      let detailSection = null;
      for (let j = 0; j < sectionHeaders.length; j++) {
        if (sectionHeaders[j].textContent === 'Mission Details') {
          detailSection = sectionHeaders[j].nextElementSibling;
          break;
        }
      }

      let description = '';
      while (detailSection && detailSection.tagName === 'SECTION') {
        const header = detailSection.firstElementChild.firstElementChild.textContent;
        const ps = detailSection.getElementsByTagName('p');
        let totalStr = '';
        for (let k = 0; k < ps.length; k++) {
          totalStr += ps[k].textContent;
        }

        if (totalStr === '') {
          totalStr = 'No mission description available.';
        } else {
          rawAffiliations.push(totalStr);
        }

        description += `**${header}**\n${totalStr}\n\n`;
        detailSection = detailSection.nextSibling;
      }

      launches.push({
        affiliations: getAffiliations(rawAffiliations.join(' ')),
        date: new Date(timeObj.startDate).toISOString().split('T')[0],
        description: description.trim(),
        launchSite,
        mission,
        time: timeObj,
        vehicle,
      });
    }

    // Comment this out when working on handling new formats
    // console.log(launches);
    // return {
    //   success: true,
    //   data: [],
    // };
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
    if (result.nUpserted + result.nModified !== bulkWriteArray.length) {
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

const handleChanges = async (report: ChangeReport) => {
  if (!report.success || !report.changes || report.changes.length === 0) {
    return;
  }

  logMessage('scraper_launches', `processing ${report.changes.length} update(s)`);
  await Promise.all(report.changes.map(async (changeItem) => {
    const newData = changeItem.data as RocketLaunchType;
    const oldData = changeItem.originalData as RocketLaunchType;
    const boosters = newData.vehicle === 'Falcon 9' || newData.vehicle === 'Falcon Heavy'
      ? await collections.boosters.find({
        'assignments.date': unixTimeToBoosterDate(newData.time.sortDate),
      }).toArray() as Falcon9BoosterType[]
      : [];

    handleLaunchUpdate(newData, boosters);
    let embed: MessageEmbed | null = null;

    if (changeItem.changeType === ChangeReportTypeEnum.NEW) {
      embed = new MessageEmbed()
        .setColor('#ff0000')
        .setTitle(`${newData.vehicle} ● ${newData.mission}`)
        .setAuthor({
          name: 'New Launch Posted!',
          iconUrl: 'https://i.gyazo.com/bbfc6b20b64ac0db894f112e14a58cd5.jpg',
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
        .setAuthor({
          name: 'Launch Update!',
          iconURL: 'https://i.gyazo.com/bbfc6b20b64ac0db894f112e14a58cd5.jpg',
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
        const currentAssignmentIndex = booster.assignments.findIndex(
          (assignment) => assignment.date === unixTimeToBoosterDate(newData.time.startDate),
        );
        const currentAssignment = booster.assignments[currentAssignmentIndex];
        const details = [
          `- Flight no. ${currentAssignmentIndex + 1}`,
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
      ChannelClassEnum.LAUNCH_UPDATE,
      undefined,
      embed,
      ['LAUNCH'].concat(newData.affiliations),
    );
    if (result === false) {
      logError(LogCategoriesEnum.ANNOUNCE_FAILURE, 'scraper_launches', 'failed to announce launch update');
    }
  }));
};

if (!config.web.devMode) {
  registerInitialLaunchTimeouts();
}

export default {
  collect,
  mergeToDatabase,
  handleChanges,
} as ScraperControllerType;
