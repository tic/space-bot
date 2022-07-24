/* eslint-disable no-unused-vars */
export type ScrapedDataReportType = {
  success: boolean,
  data: unknown | null,
}

export type ScraperControllerType = {
  collect: () => Promise<ScrapedDataReportType>,
  mergeToDatabase: (arg0: ScrapedDataReportType) => Promise<boolean>,
};

export type GlobalConfigType = {
  discord: {
    secret: string,
    username: string,
  },
  mongo: {
    password: string,
    primaryDatabase: string,
    url: string,
    username: string,
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
