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
  scrapers: {
    boosters: {
      url: string,
    },
    closures: {
      url: string,
    },
    launches: {
      url: string,
    },
    notams: {
      url: string,
      base: string,
    },
    weather: {
      url: string,
    },
  },
  discord: {
    secret: string,
    username: string,
  },
  mongo: {
    url: string,
    primaryDatabase: string,
    username: string,
    password: string,
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
