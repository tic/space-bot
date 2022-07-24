import { ScraperControllerType } from '../types/globalTypes';
import { logError } from './logger.service';
import { LogCategoriesEnum } from '../types/serviceLoggerTypes';

export const setIntervalAndStart = (fn: () => void, intervalMs: number) => {
  if (intervalMs > 20000) {
    setTimeout(fn, 5000);
  }
  return setInterval(fn, intervalMs);
};

export const wrapScraperHandler = (
  identifier: string,
  controller: ScraperControllerType,
) : () => Promise<void> => async () => {
  const dataReport = await controller.collect();
  if (dataReport.success === false) {
    logError(LogCategoriesEnum.SCRAPE_FAILURE, identifier);
    return;
  }
  if (await controller.mergeToDatabase(dataReport) === false) {
    logError(LogCategoriesEnum.DB_MERGE_FAILURE, identifier);
  }
};
