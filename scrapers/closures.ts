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
import { logError } from '../services/logger.service';
import {
  BeachStatusEnum,
  RoadClosureType,
  RoadClosureTypeEnum,
} from '../types/databaseModels';
import {
  ChangeReport,
  ChangeReportTypeEnum,
  fullMonths,
  ImpossibleRegexError,
  ScraperControllerType,
} from '../types/globalTypes';
import {
  ClosureDataReportType,
  closureDateRegexp,
  dateRangeRegexp,
  primaryDateRegexp,
  timeRegexp,
} from '../types/scraperClosureTypes';
import { ChannelClassEnum } from '../types/serviceDiscordTypes';
import { LogCategoriesEnum } from '../types/serviceLoggerTypes';

const collect = async () : Promise<ClosureDataReportType> => {
  try {
    const { data: parsedResult } = await axios.get(config.scrapers.closures.url);
    const dom = new JSDOM(parsedResult);
    const tablesOnPage = dom.window.document.getElementsByTagName('table');
    if (tablesOnPage.length !== 1) {
      throw new Error('Unexpected table count in road closure scraper');
    }
    const tableRows = tablesOnPage[0].getElementsByTagName('tr');
    const closures: RoadClosureType[] = [];
    for (let i = 1; i < tableRows.length; i++) {
      const dataColumns = tableRows[i].getElementsByTagName('td');
      if (dataColumns.length !== 4) {
        continue;
      }
      const [rawClosureType, rawDate, rawTime, rawBeachStatus] = [0, 0, 0, 0].map(
        (_, index) => dataColumns[index].textContent?.trim() || '',
      );
      if (!rawDate.match(closureDateRegexp)) {
        continue;
      }
      const parsedClosureType = rawClosureType.match(primaryDateRegexp)
        ? RoadClosureTypeEnum.PRIMARY
        : RoadClosureTypeEnum.ALTERNATIVE;
      const datePieces = rawDate.match(closureDateRegexp) || [];
      if (datePieces.length !== 5) {
        throw ImpossibleRegexError;
      }
      const parsedDate = DateTime.local(
        parseInt(datePieces[4], 10),
        fullMonths.indexOf(datePieces[2].toUpperCase()),
        parseInt(datePieces[3], 10),
        1,
      );
      if (!rawTime.match(dateRangeRegexp)) {
        continue;
      }
      let parsedBeachStatus: BeachStatusEnum | null = null;
      if (rawBeachStatus.match(/canceled/i)) {
        parsedBeachStatus = BeachStatusEnum.CLOSURE_CANCELED;
      } else if (rawBeachStatus.match(/scheduled/i)) {
        parsedBeachStatus = BeachStatusEnum.CLOSURE_SCHEDULED;
      } else if (rawBeachStatus.match(/possible/i)) {
        parsedBeachStatus = BeachStatusEnum.CLOSURE_POSSIBLE;
      }
      if (parsedBeachStatus === null) {
        continue;
      }
      const timePiecesCollection = rawTime.matchAll(dateRangeRegexp) || [];
      let closureIndex = 0;
      // eslint-disable-next-line no-restricted-syntax
      for (const timePieces of timePiecesCollection) {
        const startPieces = timePieces[2].match(timeRegexp);
        if (startPieces === null || startPieces.length !== 4) {
          continue;
        }
        let startHour = parseInt(startPieces[1], 10) % 12;
        const startMinute = parseInt(startPieces[2], 10);
        if (startPieces[3].toUpperCase() === 'P') {
          startHour += 12;
        }
        const stopPieces = timePieces[3].match(timeRegexp);
        if (stopPieces === null || stopPieces.length !== 4) {
          continue;
        }
        let stopHour = parseInt(stopPieces[1], 10) % 12;
        const stopMinute = parseInt(stopPieces[2], 10);
        if (stopPieces[3].toUpperCase() === 'P') {
          stopHour += 12;
        }
        closures.push({
          closureCode: `${closureIndex++}_${parsedDate.month}.${parsedDate.day}.${parsedDate.year}`,
          startDate: parsedDate.set({
            hour: startHour,
            minute: startMinute,
          }).plus({ hours: 1 }).toMillis(),
          status: parsedBeachStatus,
          stopDate: parsedDate.set({
            hour: stopHour,
            minute: stopMinute,
          }).plus({
            days: stopHour < startHour ? 1 : 0,
            hours: 1,
          }).toMillis(),
          type: parsedClosureType,
        });
      }
    }
    return {
      success: true,
      data: closures,
    } as ClosureDataReportType;
  } catch (error) {
    console.error(error);
    return {
      success: false,
      data: null,
    };
  }
};

const mergeToDatabase = async (report: ClosureDataReportType) : Promise<ChangeReport> => {
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
      collections.roadClosures,
      { $or: report.data.map((closureData) => ({ closureCode: closureData.closureCode })) },
      report,
      (currentDbItem: RoadClosureType) => (
        testDbItem: RoadClosureType,
      ) => currentDbItem.closureCode === testDbItem.closureCode,
      (dbItem: RoadClosureType) => ({ closureCode: dbItem.closureCode }),
    );
    if (bulkWriteArray.length === 0) {
      return {
        success: true,
        changes: [],
      };
    }
    const result = await collections.roadClosures.bulkWrite(bulkWriteArray);
    if (result.upsertedCount + result.modifiedCount !== bulkWriteArray.length) {
      return {
        success: false,
        changes: null,
        message: 'database performed an unexpected number of results',
      };
    }
    return {
      success: true,
      changes: changeItems,
    };
  } catch (error) {
    logError(LogCategoriesEnum.DB_MERGE_FAILURE, 'scraper_closure', String(error));
    return {
      success: false,
      changes: null,
    };
  };
};

const handleChanges = async (report: ChangeReport) => {
  if (!report.success || !report.changes || report.changes.length === 0) {
    return;
  }
  report.changes.forEach(async (changeItem) => {
    const newData = changeItem.data as RoadClosureType;
    const oldData = changeItem.originalData as RoadClosureType;
    let embed: MessageEmbed | null = null;
    if (changeItem.changeType === ChangeReportTypeEnum.NEW) {
      embed = new MessageEmbed()
        .setColor('#00ff00')
        .setTitle('Road Closure Posted')
        .setURL('https://cameroncountytx.gov/spacex/')
        .setAuthor({
          name: 'Highway 4 - Cameron County',
          url: 'https://cameroncountytx.gov/wp-content/uploads/2020/02/CCSEAL_TRANSPARENT.png',
          iconURL: 'https://cameroncountytx.gov/spacex/',
        })
        .setDescription('A new closure of Highway 4 in Boca Chica has been posted.')
        .addFields(
          {
            name: 'Type',
            value: newData.type,
            inline: true,
          },
          {
            name: 'Status',
            value: newData.status,
            inline: true,
          },
          {
            name: 'Closure Begins',
            value: `<t:${newData.startDate / 1000}:F>`,
          },
          {
            name: 'Closure Ends',
            value: `<t:${newData.stopDate / 1000}:F>`,
          },
        )
        .setTimestamp();
    } else if (changeItem.changeType === ChangeReportTypeEnum.UPDATED) {
      embed = new MessageEmbed()
        .setColor('#ffff00')
        .setTitle('Road Closure Modification')
        .setURL('https://cameroncountytx.gov/spacex/')
        .setAuthor({
          name: 'Highway 4 - Cameron County',
          iconURL: 'https://cameroncountytx.gov/wp-content/uploads/2020/02/CCSEAL_TRANSPARENT.png',
          url: 'https://cameroncountytx.gov/spacex/',
        } as EmbedAuthorData)
        .setDescription('Details surrounding a closure of Highway 4 in Boca Chica have changed.')
        .addFields(
          {
            name: 'Type',
            value: oldData.type === newData.type ? newData.type : `~~${oldData.type}~~\n${newData.type}`,
            inline: true,
          },
          {
            name: 'Status',
            value: oldData.status === newData.status ? newData.status : `~~${oldData.status}~~\n${newData.status}`,
            inline: true,
          },
          {
            name: 'Closure Begins',
            value: oldData.startDate === newData.startDate
              ? `<t:${newData.startDate / 1000}:F>`
              : `~~<t:${oldData.startDate / 1000}:F>~~\n<t:${newData.startDate / 1000}:F>`,
          },
          {
            name: 'Closure Ends',
            value: oldData.stopDate === newData.stopDate
              ? `<t:${newData.stopDate / 1000}:F>`
              : `~~<t:${oldData.stopDate / 1000}:F>~~\n<t:${newData.stopDate / 1000}:F>`,
          },
        )
        .setTimestamp();
    }
    if (!embed) {
      return;
    }
    const result = await announce(
      ChannelClassEnum.CLOSURE_UPDATE,
      undefined,
      embed,
      ['CLOSURE'],
    );
    if (result === false) {
      logError(LogCategoriesEnum.ANNOUNCE_FAILURE, 'scraper_closures', 'failed to announce closures update');
    }
  });
};

export default {
  collect,
  mergeToDatabase,
  handleChanges,
} as ScraperControllerType;
