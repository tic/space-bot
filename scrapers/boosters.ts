import axios from 'axios';
import { JSDOM } from 'jsdom';
import { config } from '../config';
import {
  f9BoosterClassificationMap,
  F9BoosterClassificationType,
  Falcon9Assignment,
  Falcon9BoosterType,
} from '../types/databaseModels';
import { ScraperControllerType } from '../types/globalTypes';
import { BoosterDataReportType } from '../types/scraperBoosterTypes';

type ColumnName = 'boosterSN'
  | 'boosterType'
  | 'launches'
  | 'launchDate'
  | 'flightDesignation'
  | 'turnaroundTime'
  | 'payload'
  | 'launchDetails'
  | 'recoveryDetails'
  | 'status';

const columnOrder: ColumnName[] = [
  'boosterSN',
  'boosterType',
  'launches',
  'launchDate',
  'flightDesignation',
  'turnaroundTime',
  'payload',
  'launchDetails',
  'recoveryDetails',
  'status',
];
const defaultBooster = {
  boosterSN: null,
  boosterType: null,
  flightDesignation: null,
  launchDate: null,
  launchDetails: null,
  launches: null,
  turnaroundTime: null,
  payload: null,
  recoveryDetails: null,
  status: null,
};

const collect = async () : Promise<BoosterDataReportType> => {
  try {
    const { data: parsedResult } = await axios.get(config.scrapers.boosters.url);
    const dom = new JSDOM(parsedResult);
    const tables = dom.window.document.getElementsByClassName('wikitable');
    if (tables.length !== 3) {
      throw new Error('Unexpected table count in booster scraper');
    }
    const blockFiveTableRows = tables[2].getElementsByTagName('tr');
    if (blockFiveTableRows.length < 2) {
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
      const rawAssignments = allAssignments.filter((rawAssignment) => (
        rawAssignment.boosterSN === boosterSN
        && rawAssignment.boosterType !== null
        && rawAssignment.flightDesignation !== null
        && rawAssignment.launchDate !== null
        && rawAssignment.launchDetails !== null
        && rawAssignment.recoveryDetails !== null
        && rawAssignment.status !== null
        && rawAssignment.turnaroundTime !== null
      ));
      const mostRecentAssignment = rawAssignments[rawAssignments.length - 1];
      return {
        boosterSN,
        currentClassification: f9BoosterClassificationMap[
          mostRecentAssignment.boosterType as string
        ] || F9BoosterClassificationType.UNKNOWN,
        assignments: rawAssignments.map((rawAssignment, index) => {
          const [launchStatus, launchLocation] = (rawAssignment.launchDetails as string).split(' ');
          const assignment: Falcon9Assignment = {
            boosterFlightNumber: index + 1,
            date: rawAssignment.launchDate as string,
            flightDesignation: rawAssignment.flightDesignation as string,
            launchDetails: {
              location: launchLocation,
              status: launchStatus,
            },
            turnaroundTime: rawAssignment.turnaroundTime as string,
            recoveryDetails: {
              attempted: rawAssignment.recoveryDetails?.indexOf('No attempt') === -1,
              location: null,
              status: null,
            },
          };
          if (assignment.recoveryDetails.attempted && rawAssignment.recoveryDetails) {
            const [recoveryStatus, recoveryLocation] = rawAssignment.recoveryDetails.split(' ');
            assignment.recoveryDetails.status = recoveryStatus;
            assignment.recoveryDetails.location = recoveryLocation;
          }
          return assignment;
        }),
        status: mostRecentAssignment.status as string,
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

const mergeToDatabase = async (data: BoosterDataReportType) : Promise<boolean> => {
  console.log(data);
  return false;
};

export default {
  collect,
  mergeToDatabase,
} as ScraperControllerType;
