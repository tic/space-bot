import axios from 'axios';
import { JSDOM } from 'jsdom';
import { config } from '../config';
import {
  collections,
  createBulkWriteArray,
} from '../services/database.service';
import { logError } from '../services/logger.service';
import {
  f9BoosterClassificationMap,
  F9BoosterClassificationType,
  Falcon9Assignment,
  Falcon9BoosterType,
} from '../types/databaseModels';
import {
  ChangeReport,
  ScraperControllerType,
} from '../types/globalTypes';
import {
  BoosterDataReportType,
  ColumnName,
  RawAssignmentType,
  StringToLandingLocation,
  columnOrder,
  defaultBooster,
} from '../types/scraperBoosterTypes';
import { LogCategoriesEnum } from '../types/serviceLoggerTypes';

const processRawAssignment = (rawAssignment: RawAssignmentType, index: number) => {
  const [launchStatus, rawLaunchLocation] = (rawAssignment.launchDetails as string).split(' ');
  const launchLocationPieces = (rawLaunchLocation || '').match(/\(([^()]*)\)/) || [];
  let cleanLocation = 'Unknown';
  if (launchLocationPieces.length === 2) {
    if (['4E', '39A', '40'].includes(launchLocationPieces[1])) {
      cleanLocation = `LC-${launchLocationPieces[1]}`;
    } else {
      cleanLocation = `${launchLocationPieces[1]}`;
    }
  }

  const assignment: Falcon9Assignment = {
    boosterFlightNumber: index + 1,
    date: rawAssignment.launchDate as string,
    flightDesignation: rawAssignment.flightDesignation as string,
    launchDetails: {
      location: cleanLocation,
      status: launchStatus,
    },
    turnaroundTime: rawAssignment.turnaroundTime as string,
    recoveryDetails: {
      attempted:
        rawAssignment.recoveryDetails?.indexOf('No attempt') === -1
        && rawAssignment.recoveryDetails?.indexOf('Not yet known') === -1,
      location: null,
      status: null,
    },
  };

  if (assignment.recoveryDetails.attempted && rawAssignment.recoveryDetails) {
    const [recoveryStatus, rawRecoveryLocation] = rawAssignment.recoveryDetails.split(' ');
    const recoveryLocationPieces = (rawRecoveryLocation || '').match(/\(([^()]*)\)/) || [];

    if (recoveryLocationPieces.length === 2) {
      const recoveryLocation = StringToLandingLocation[recoveryLocationPieces[1]]
        || StringToLandingLocation.UNKNOWN;
      assignment.recoveryDetails.status = recoveryStatus;
      assignment.recoveryDetails.location = recoveryLocation;
    }
  }

  return assignment;
};

const getRelevantAssignmentFinder = (boosterSN: string) => (rawAssignment: RawAssignmentType) => (
  rawAssignment.boosterSN === boosterSN
  && rawAssignment.boosterType !== null
  && rawAssignment.flightDesignation !== null
  && rawAssignment.launchDate !== null
  && rawAssignment.launchDetails !== null
  && rawAssignment.recoveryDetails !== null
  && rawAssignment.status !== null
  && rawAssignment.turnaroundTime !== null
);

const collect = async () : Promise<BoosterDataReportType> => {
  try {
    const { data: parsedResult } = await axios.get(config.scrapers.boosters.url);
    const dom = new JSDOM(parsedResult);
    const tables = dom.window.document.getElementsByClassName('wikitable');

    if (tables.length !== 4) {
      throw new Error('Unexpected table count in booster scraper');
    }

    const inactiveBlockFiveTableRows = tables[2].getElementsByTagName('tr');
    const activeBlockFiveTableRows = tables[3].getElementsByTagName('tr');
    const blockFiveTableRows = Array.from(inactiveBlockFiveTableRows).concat(Array.from(activeBlockFiveTableRows));

    if (blockFiveTableRows.length < 4) {
      throw new Error('Unexpectedly small table in booster scraper');
    }

    const allAssignments: Record<ColumnName, string | null>[] = [
      ...new Array(blockFiveTableRows.length - 1),
    ].map(() => ({ ...defaultBooster }));

    for (let i = 0; i < allAssignments.length; i++) {
      const tableRow = blockFiveTableRows[i + 1];
      const dataBlobs = tableRow.getElementsByTagName('td');
      let blobNumber = 0;

      for (let j = 0; j < columnOrder.length; j++) {
        const columnName = columnOrder[j];

        if (allAssignments[i][columnName] === null) {
          const currentBlob = dataBlobs[blobNumber];
          if (!currentBlob) {
            continue;
          }

          const affectedRowCount = parseInt(currentBlob.getAttribute('rowspan') || '1', 10);
          for (let k = 0; k < affectedRowCount; k++) {
            allAssignments[i + k][columnName] = currentBlob.textContent?.trim().replace(/\[.*\]/, '') || null;
          }

          blobNumber++;
        }
      }
    }

    const boosterSNs: string[] = Array.from(
      new Set(allAssignments.map((assignment) => assignment.boosterSN)),
    ).filter((boosterSN) => boosterSN !== null) as string[];

    const boosterObjects: Falcon9BoosterType[] = boosterSNs.map((boosterSN) => {
      const rawAssignments = allAssignments.filter(getRelevantAssignmentFinder(boosterSN));
      const mostRecentAssignment = rawAssignments[rawAssignments.length - 1];
      const assignments = rawAssignments.map(processRawAssignment);
      const mostRecentClassification = f9BoosterClassificationMap[mostRecentAssignment.boosterType];

      return {
        boosterSN,
        assignments,
        currentClassification: mostRecentClassification || F9BoosterClassificationType.UNKNOWN,
        status: mostRecentAssignment.status,
      };
    });

    return {
      success: true,
      data: boosterObjects,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      data: null,
    };
  }
};

const mergeToDatabase = async (report: BoosterDataReportType) : Promise<ChangeReport> => {
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
      collections.boosters,
      { $or: report.data.map((boosterData) => ({ boosterSN: boosterData.boosterSN })) },
      report,
      (currentDbItem: Falcon9BoosterType) => (
        testDbItem: Falcon9BoosterType,
      ) => currentDbItem.boosterSN === testDbItem.boosterSN,
      (dbItem: Falcon9BoosterType) => ({ boosterSN: dbItem.boosterSN }),
    );
    if (bulkWriteArray.length === 0) {
      return {
        success: true,
        changes: [],
      };
    }
    const result = await collections.boosters.bulkWrite(bulkWriteArray);
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
    logError(LogCategoriesEnum.DB_MERGE_FAILURE, 'scraper_booster', error);
    return {
      success: false,
      changes: null,
    };
  }
};

const handleChanges = async () => {
  // Currently, boosters don't post any updates...
};

export default {
  collect,
  mergeToDatabase,
  handleChanges,
} as ScraperControllerType;
