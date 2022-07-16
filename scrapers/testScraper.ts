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
if (!folderEntries.includes('testScrapers.ts')) {
  folderEntries = readdirSync('./scrapers');
  if (!folderEntries.includes('testScraper.ts')) {
    console.log(
      '[ERROR] The script must be run from either the project'
      + 'root directory or from the "scrapers/" directory.',
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
const scraperController = require(`./${argv[2]}`).default;
scraperController.collect()
  .then((collectionResult: ScrapedDataReportType) => {
    console.log(collectionResult);
  })
  .catch((error: Error) => {
    console.error(error);
  });
