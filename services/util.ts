import { fullMonths, ScraperControllerType } from '../types/globalTypes';
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
  const changeReport = await controller.mergeToDatabase(dataReport);
  if (changeReport.success === false) {
    logError(LogCategoriesEnum.DB_MERGE_FAILURE, identifier, changeReport.message);
    return;
  }
  // The scraper controller needs to handle the change report
  controller.handleChanges(changeReport);
};

export const unixTimeToHoursAndMinutes = (date: number) => {
  const dateObj = new Date(date);
  const minutes = dateObj.getMinutes();
  const hours = dateObj.getHours();
  const minuteStr = minutes < 10 ? `0${minutes}` : minutes.toString();
  const hourStr = hours < 10 ? `0${hours}` : hours.toString();
  return `${hourStr}:${minuteStr}`;
};

export const unixTimeToBoosterDate = (date: number) => {
  const dateObj = new Date(date);
  const dayOfMonth = dateObj.getUTCDate();
  const fullMonthUppercase = fullMonths[dateObj.getUTCMonth() + 1];
  const fullMonth = fullMonthUppercase.charAt(0) + fullMonthUppercase.slice(1).toLowerCase();
  const year = dateObj.getUTCFullYear();
  return `${dayOfMonth} ${fullMonth} ${year}`;
};
