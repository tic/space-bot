import axios from 'axios';
import { EmbedFieldData, MessageEmbed } from 'discord.js';
import { JSDOM } from 'jsdom';
import { DateTime } from 'luxon';
import { config } from '../config';
import {
  collections,
  createBulkWriteArray,
} from '../services/database.service';
import { announce } from '../services/discord.service';
import { logError } from '../services/logger.service';
import { unixTimeToNotamDate } from '../services/util';
import { NotamType } from '../types/databaseModels';
import {
  ChangeReport,
  ChangeReportTypeEnum,
  ScraperControllerType,
} from '../types/globalTypes';
import { NotamDataReportType, NotamTemplateType } from '../types/scraperNotamTypes';
import { ChannelClassEnum } from '../types/serviceDiscordTypes';
import { LogCategoriesEnum } from '../types/serviceLoggerTypes';

let removedOnLastRun: NotamType[] = [];
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
      if (!notamId.match(notamLinkRegexp)) {
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
        notamId,
        altitude: null,
        imageUrl: idToNotamImageUrl(notamId),
        issuedDate: null,
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
        if (altitudeRowData.match(unlimitedAltitudeRegexp)) {
          notamObject.altitude = -1;
        } else if (altitudeRowData.match(fixedAltitudeRegexp)) {
          const result = altitudeRowData.match(fixedAltitudeRegexp) || [];
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

const mergeToDatabase = async (report: NotamDataReportType) : Promise<ChangeReport> => {
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
      collections.notams,
      { $or: report.data.map((notamData) => ({ notamId: notamData.notamId })) },
      report,
      (currentDbItem: NotamType) => (
        testDbItem: NotamType,
      ) => currentDbItem.notamId === testDbItem.notamId,
      (dbItem: NotamType) => ({ notamId: dbItem.notamId }),
    );
    if (bulkWriteArray.length === 0) {
      return {
        success: true,
        changes: [],
      };
    }
    const result = await collections.notams.bulkWrite(bulkWriteArray);
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
    logError(LogCategoriesEnum.DB_MERGE_FAILURE, 'scraper_notams', String(error));
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
  report.changes.forEach(async (changeItem) => {
    const newData = changeItem.data as NotamType;
    const oldData = changeItem.originalData as NotamType;
    let embed: MessageEmbed | null = null;
    if (changeItem.changeType === ChangeReportTypeEnum.NEW) {
      const previouslyRemovedNotamIndex = removedOnLastRun.findIndex((item) => item.notamId === newData.notamId);
      if (previouslyRemovedNotamIndex > -1) {
        removedOnLastRun = removedOnLastRun.filter((_, index) => index !== previouslyRemovedNotamIndex);
        return;
      }
      embed = new MessageEmbed()
        .setColor('#00ff00')
        .setTitle(`NOTAM Posted for ${unixTimeToNotamDate(newData.startDate)}`)
        .setURL(newData.notamUrl)
        .setAuthor({
          name: 'Federal Aviation Administration (FAA)',
          iconURL: 'https://i.gyazo.com/ab618db4d6b3a93650aa4c786bb56567.png',
          url: 'https://www.faa.gov/',
        })
        .setDescription('A new Temporary Flight Restriction (TFR) has been posted. Details of the TFR are shown below.')
        .addFields(
          {
            name: 'Notam Id',
            value: newData.notamId,
            inline: true,
          },
          {
            name: 'Altitude',
            value: `${newData.altitude}${newData.altitude === -1 ? '' : ' feet MSL'}`,
            inline: true,
          },
          {
            name: 'Restriction Begins',
            value: `<t:${newData.startDate}:F>`,
          },
          {
            name: 'Restriction Ends',
            value: `<t:${newData.stopDate}:F>`,
          },
        )
        .setThumbnail(newData.imageUrl)
        .setTimestamp();
    } else if (changeItem.changeType === ChangeReportTypeEnum.UPDATED) {
      embed = new MessageEmbed()
        .setColor('#ffff00')
        .setTitle(`NOTAM Modified for ${unixTimeToNotamDate(newData.startDate)}`)
        .setURL(newData.notamUrl)
        .setAuthor({
          name: 'Federal Aviation Administration (FAA)',
          iconURL: 'https://i.gyazo.com/ab618db4d6b3a93650aa4c786bb56567.png',
          url: 'https://www.faa.gov/',
        })
        .setDescription('An existing Temporary Flight Restriction (TFR) has been modified.')
        .addFields(
          {
            name: 'Notam Id',
            value: newData.notamId,
            inline: true,
          } as EmbedFieldData,
          {
            name: 'Altitude',
            value: oldData.altitude === newData.altitude
              ? newData.altitude
              : `~~${oldData.altitude}~~\n${newData.altitude}${newData.altitude === -1 ? '' : ' feet MSL'}`,
            inline: true,
          } as EmbedFieldData,
          {
            name: 'Restriction Begins',
            value: oldData.startDate === newData.startDate
              ? `<t:${newData.startDate}:F>`
              : `~~<t:${oldData.startDate}:F>~~\n<t:${newData.startDate}:F>`,
          },
          {
            name: 'Restriction Ends',
            value: oldData.stopDate === newData.stopDate
              ? `<t:${newData.stopDate}:F>`
              : `~~<t:${oldData.stopDate}:F>~~\n<t:${newData.stopDate}:F>`,
          },
        )
        .setThumbnail(newData.imageUrl)
        .setTimestamp();
    }
    if (!embed) {
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
  removedOnLastRun.forEach(async (notam) => {
    const embed = new MessageEmbed()
      .setColor('#ff0000')
      .setTitle(`NOTAM for Removed for ${unixTimeToNotamDate(notam.startDate)}`)
      .setURL(notam.notamUrl)
      .setAuthor({
        name: 'Federal Aviation Administration (FAA)',
        iconURL: 'https://i.gyazo.com/ab618db4d6b3a93650aa4c786bb56567.png',
        url: 'https://www.faa.gov/',
      })
      .setDescription(
        'An existing Temporary Flight Restriction (TFR) was '
        + 'removed. The previous details for the TFR are shown below.',
      )
      .addFields(
        {
          name: 'Notam Id',
          value: `${notam.notamId}`,
          inline: true,
        },
        {
          name: 'Altitude',
          value: `${notam.altitude}${notam.altitude === -1 ? '' : ' feet MSL'}`,
          inline: true,
        },
        {
          name: 'Restriction Begins',
          value: `<t:${notam.startDate}:F>`,
        },
        {
          name: 'Restriction Ends',
          value: `<t:${notam.stopDate}:F>`,
        },
      )
      .setThumbnail(notam.imageUrl)
      .setTimestamp();
    const result = await announce(
      ChannelClassEnum.NOTAM_UPDATE,
      undefined,
      embed,
      [],
    );
    if (result === false) {
      logError(LogCategoriesEnum.ANNOUNCE_FAILURE, 'scraper_notams', 'failed to announce notam update');
    }
  });
};

export default {
  collect,
  mergeToDatabase,
  handleChanges,
} as ScraperControllerType;
