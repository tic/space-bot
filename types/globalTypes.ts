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
    port: number,
    username: string,
    password: string,
  },
};
