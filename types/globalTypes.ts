/* eslint-disable no-shadow */
/* eslint-disable no-unused-vars */
import { ObjectId } from 'mongodb';
import { DiscordServerType } from './serviceDiscordTypes';

export type ScrapedDataType = {
  _id?: ObjectId,
  id?: string,
};

export enum ChangeReportTypeEnum {
  NEW = 'NEW',
  UPDATED = 'UPDATED',
  REMOVED = 'REMOVED',
};

export type ChangeItemType = {
  changeType: ChangeReportTypeEnum,
  data: ScrapedDataType,
  originalData: ScrapedDataType | null,
};

export type ChangeReport = {
  success: boolean,
  changes: null | ChangeItemType[],
  message?: string,
};

export type ScrapedDataReportType = {
  success: boolean,
  data: ScrapedDataType[] | null,
}

export type ScraperName = 'boosters' |
'closures' |
'launches' |
'notams' |
'weather';

export type ScraperControllerType = {
  collect: () => Promise<ScrapedDataReportType>,
  mergeToDatabase: (arg0: ScrapedDataReportType) => Promise<ChangeReport>,
  handleChanges: (arg0: ChangeReport) => void;
};

export type GlobalConfigType = {
  discord: {
    secret: string,
    username: string,
    servers: DiscordServerType[],
  },
  mongo: {
    password: string,
    primaryDatabase: string,
    url: string,
    username: string,
  },
  web: {
    port: number,
  },
  scrapers: {
    boosters: {
      intervalMs: number,
      identifier: string,
      url: string,
    },
    closures: {
      intervalMs: number,
      identifier: string,
      url: string,
    },
    launches: {
      intervalMs: number,
      identifier: string,
      url: string,
    },
    notams: {
      base: string,
      identifier: string,
      intervalMs: number,
      url: string,
    },
    weather: {
      intervalMs: number,
      identifier: string,
      url: string,
    },
  },
};

export const ImpossibleRegexError = new Error('Impossible regex condition');

export const abbreviatedMonths = [
  '',
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEPT',
  'OCT',
  'NOV',
  'DEC',
];

export const fullMonths = [
  '',
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

export const fullDays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
