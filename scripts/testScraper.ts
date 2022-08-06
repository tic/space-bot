import {
  readdirSync,
} from 'fs';
import { ScrapedDataReportType } from '../types/globalTypes';

const { argv } = process;

if (argv.length < 2) {
  console.log('[ERROR] You must provide a scraper to test');
  process.exit(1);
}

let folderEntries = readdirSync('.');
let baseLocation = '../scrapers';
if (!folderEntries.includes('testScrapers.ts')) {
  folderEntries = readdirSync('./scrapers');
  baseLocation = './scrapers';
  if (!folderEntries.includes('testScraper.ts')) {
    console.log(
      '[ERROR] The script must be run from either the project'
      + 'root directory or from the "scripts/" directory.',
    );
    process.exit(1);
  }
}

const scraperFile = `${argv[2]}.ts`;
if (!folderEntries.includes(scraperFile)) {
  console.log('[ERROR] Could not find the specified scraper (scrapers/%s)', scraperFile);
  process.exit(1);
}

// eslint-disable-next-line import/no-dynamic-require
const scraperController = require(`${baseLocation}/${argv[2]}`).default;
console.log('==========  EXECUTING  SCRAPER  ==========');
scraperController.collect()
  .then((collectionResult: ScrapedDataReportType) => {
    console.log(
      '========== SCRAPER RETURN VALUE ==========\n',
      collectionResult,
    );
  })
  .catch((error: Error) => {
    console.error(error);
  });
