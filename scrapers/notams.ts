import axios from 'axios';
import { JSDOM } from 'jsdom';
import { DateTime } from 'luxon';
import { config } from '../config';
import { NotamType } from '../types/databaseModels';
import { ScraperControllerType } from '../types/globalTypes';
import { NotamDataReportType, NotamTemplateType } from '../types/scraperNotamTypes';

const timestampFormat = 'MMMM dd\', \'yyyy\' at \'HHmm\' UTC\'Z';
const notamLinkRegexp = /\d\/\d{4}/;
const unlimitedAltitudeRegexp = /unlimited/i;
const fixedAltitudeRegexp = /(\d+) feet MSL/;
const idToFullNotamUrl = (id: string) : string => `${
  config.scrapers.notams.base
}/save_pages/detail_${id.replace('/', '_')}.html`;
const idToNotamImageUrl = (id: string) : string => `${
  config.scrapers.notams.base
}/save_maps/small_${id.replace('/', '_')}.gif`;

const collect = async () : Promise<NotamDataReportType> => {
  try {
    const { data: parsedResult } = await axios.get(config.scrapers.notams.url);
    const dom = new JSDOM(parsedResult);
    const allTables = dom.window.document.getElementsByTagName('table');
    let notamTable;
    for (let i = 0; i < allTables.length; i++) {
      const tableCandidate = allTables[i];
      if (tableCandidate.getAttribute('width') === '970') {
        notamTable = tableCandidate;
        break;
      }
    }
    if (notamTable === undefined) {
      throw new Error('Failed to locate notam table in notam scraper');
    }

    const rawNotamRows = notamTable.getElementsByTagName('tr');
    const notamLinksToVisit: [string, string][] = [];
    for (let i = 0; i < rawNotamRows.length; i++) {
      const notamCandidate = rawNotamRows[i];
      if (notamCandidate.getAttribute('height') !== '40') {
        continue;
      }
      const notamCandidateFields = notamCandidate.getElementsByTagName('td');
      if (
        notamCandidateFields.length !== 7
        || notamCandidateFields[4].textContent?.trim() !== 'SPACE OPERATIONS'
        || (notamCandidateFields[5].textContent?.indexOf('Brownsville') || -1) === -1
      ) {
        continue;
      }
      const notamLinkElements = notamCandidateFields[1].getElementsByTagName('a');
      if (notamLinkElements.length !== 1) {
        throw new Error('Unexpected multi-link in notam table in notam scraper');
      }
      const notamId = notamLinkElements[0].textContent;
      if (notamId === null) {
        throw new Error('Unexpected null link in notam row in notam scraper');
      }
      if (!notamLinkRegexp.test(notamId)) {
        throw new Error('Unknown notam link format');
      }
      notamLinksToVisit.push([idToFullNotamUrl(notamId), notamId]);
    }

    const notams = await Promise.all(notamLinksToVisit.map(async ([notamLink, notamId]) => {
      const { data: notamData } = await axios.get(notamLink);
      const notamDom = new JSDOM(notamData);
      const notamPageTables = notamDom.window.document.getElementsByTagName('table');
      const dataIndices: number[] = [];
      for (let i = 0; i < notamPageTables.length; i++) {
        if (notamPageTables[i].getAttribute('width') === '500') {
          dataIndices.push(i);
        }
      }
      if (dataIndices.length !== 2) {
        console.error('Unsupported notam format');
        return null;
      }
      const [notamNumberTableIndex, affectedAreaTableIndex] = dataIndices;
      const primaryDataComponents = notamPageTables[notamNumberTableIndex].getElementsByTagName('tr');
      const secondaryDataComponents = notamPageTables[affectedAreaTableIndex].getElementsByTagName('tr');
      if (primaryDataComponents.length !== 12 || secondaryDataComponents.length !== 10) {
        console.error('Missing data in primary or secondary notam table');
        return null;
      }
      const notamObject: NotamTemplateType = {
        altitude: null,
        imageUrl: idToNotamImageUrl(notamId),
        issuedDate: null,
        notamId,
        notamUrl: notamLink,
        startDate: null,
        stopDate: null,
      };
      const rawIssuedDate = primaryDataComponents[1].getElementsByTagName('td')[1]?.textContent;
      if (rawIssuedDate) {
        const issueTimestamp = DateTime.fromFormat(`${
          rawIssuedDate.trim()
        }+0`, timestampFormat).toMillis();
        if (typeof issueTimestamp === 'number') {
          notamObject.issuedDate = issueTimestamp;
        }
      }
      const rawStartDate = primaryDataComponents[3].getElementsByTagName('td')[1]?.textContent;
      if (rawStartDate) {
        const startTimestamp = DateTime.fromFormat(`${
          rawStartDate.trim()
        }+0`, timestampFormat).toMillis();
        if (typeof startTimestamp === 'number') {
          notamObject.startDate = startTimestamp;
        }
      }
      const rawStopDate = primaryDataComponents[4].getElementsByTagName('td')[1]?.textContent;
      if (rawStopDate) {
        const stopTimestamp = DateTime.fromFormat(`${
          rawStopDate.trim()
        }+0`, timestampFormat).toMillis();
        if (typeof stopTimestamp === 'number') {
          notamObject.stopDate = stopTimestamp;
        }
      }
      let altitudeIndex = -1;
      for (let i = 0; i < secondaryDataComponents.length; i++) {
        if (secondaryDataComponents[i].textContent?.includes('Altitude')) {
          altitudeIndex = i;
          break;
        }
      }
      if (altitudeIndex > -1) {
        const altitudeRowData = secondaryDataComponents[altitudeIndex].textContent || '';
        if (unlimitedAltitudeRegexp.test(altitudeRowData)) {
          notamObject.altitude = -1;
        } else if (fixedAltitudeRegexp.test(altitudeRowData)) {
          const result = fixedAltitudeRegexp.exec(altitudeRowData) || [];
          if (result[1]) {
            notamObject.altitude = parseInt(result[1], 10) || -2;
          }
        }
      }
      return Object.values(notamObject).includes(null)
        ? null
        : notamObject;
    }));
    return {
      success: true,
      data: notams.filter((notamCandidate) => notamCandidate !== null) as NotamType[],
    } as NotamDataReportType;
  } catch (error) {
    console.error(error);
    return {
      success: false,
      data: null,
    };
  }
};

const mergeToDatabase = async (data: NotamDataReportType) : Promise<boolean> => {
  console.log(data);
  return true;
};

export default {
  collect,
  mergeToDatabase,
} as ScraperControllerType;
