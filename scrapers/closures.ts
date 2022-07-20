import axios from 'axios';
import { JSDOM } from 'jsdom';
import { DateTime } from 'luxon';
import { config } from '../config';
import { BeachStatusEnum, RoadClosureType, RoadClosureTypeEnum } from '../types/databaseModels';
import {
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
          id: `${closureIndex++}_${parsedDate.month}.${parsedDate.day}.${parsedDate.year}`,
          startDate: parsedDate.set({
            hour: startHour,
            minute: startMinute,
          }).plus({ hours: 1 }).toMillis(),
          stopDate: parsedDate.set({
            hour: stopHour,
            minute: stopMinute,
          }).plus({
            days: stopHour < startHour ? 1 : 0,
            hours: 1,
          }).toMillis(),
          status: parsedBeachStatus,
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

const mergeToDatabase = async (data: ClosureDataReportType) : Promise<boolean> => {
  console.log(data);
  return true;
};

export default {
  collect,
  mergeToDatabase,
} as ScraperControllerType;
