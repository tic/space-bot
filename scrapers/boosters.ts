import axios from 'axios';
import { config } from '../config';
import { ScraperControllerType } from '../types/globalTypes';
import { BoosterDataReportType } from '../types/scraperBoosterTypes';

const { JSDOM } = require('jsdom');

const collect = async () : Promise<BoosterDataReportType> => {
  try {
    const { data: parsedResult } = await axios.get(config.scrapers.boosters.url);
    const soup = new JSDOM(parsedResult);
    console.log(soup);
    // To read! https://github.com/jsdom/jsdom
    return {
      success: true,
      data: [],
    };
  } catch (error) {
    return {
      success: false,
      data: null,
    };
  }
};

const mergeToDatabase = async (data: BoosterDataReportType) : Promise<boolean> => {
  console.log(data);
  return true;
};

export default {
  collect,
  mergeToDatabase,
} as ScraperControllerType;
