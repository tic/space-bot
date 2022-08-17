import {
  fullDays,
  fullMonths,
  ScraperControllerType,
} from '../types/globalTypes';
import { logError, logMessage } from './logger.service';
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

export const unixTimeToNotamDate = (date: number) => {
  const dateObj = new Date(date);
  const dayOfWeek = fullDays[dateObj.getDay()];
  const dayOfMonth = dateObj.getDate();
  let daySuffix = 'th';
  if (dayOfMonth % 10 === 1 && dayOfMonth !== 11) {
    daySuffix = 'st';
  } else if (dayOfMonth % 10 === 2 && dayOfMonth !== 12) {
    daySuffix = 'nd';
  } else if (dayOfMonth % 10 === 3 && dayOfMonth !== 13) {
    daySuffix = 'rd';
  }
  const fullMonthUppercase = fullMonths[dateObj.getUTCMonth()];
  const fullMonth = fullMonthUppercase.charAt(0) + fullMonthUppercase.slice(1).toLowerCase();
  return `${dayOfWeek}, ${fullMonth} ${dayOfMonth}${daySuffix}`;
};

export class Semaphore {
  // eslint-disable-next-line no-unused-vars
  #waitingResolvers: ((_: unknown) => void)[] = [];
  #p = 0;

  constructor(p: number) {
    if (p < 1) {
      throw new Error('a semaphore requires a p value > 0');
    }
    this.#p = p;
  }

  acquire(): Promise<() => void> {
    if (this.#p === 0) {
      return new Promise((resolve) => {
        this.#waitingResolvers.push(resolve as () => void);
      });
    }
    this.#p--;
    const resolvingFunction = () => {
      const waitingResolver = this.#waitingResolvers.shift();
      if (waitingResolver) {
        waitingResolver(resolvingFunction);
      } else {
        this.#p++;
      }
    };
    return Promise.resolve(resolvingFunction);
  }
}

export const sleep = (ms: number) => new Promise((_resolve) => {
  const resolve = _resolve as () => void;
  setTimeout(() => resolve(), ms);
});

export class ExtendedTimeout {
  static #maxTimeoutMs = 2147483647;
  #currentTimeout = null;
  #fn = null;
  #msRemaining = 0;
  #identifier = 'default';
  #active = false;

  constructor(ms: number, fn: Function, id?: string) {
    this.#active = true;
    this.#fn = fn;
    this.#msRemaining = ms;
    this.#currentTimeout = setTimeout(
      this.#migrateTimeout.bind(this),
      ms > ExtendedTimeout.#maxTimeoutMs ? ExtendedTimeout.#maxTimeoutMs : ms,
    );
    if (id) {
      this.#identifier = id;
    }
  }

  #migrateTimeout() {
    if (!this.#active) {
      return;
    }
    this.#msRemaining -= ExtendedTimeout.#maxTimeoutMs;
    if (this.#msRemaining > 0) {
      this.#currentTimeout = setTimeout(
        this.#migrateTimeout.bind(this),
        this.#msRemaining > ExtendedTimeout.#maxTimeoutMs ? ExtendedTimeout.#maxTimeoutMs : this.#msRemaining,
      );
    } else {
      this.#fn();
      this.#currentTimeout = null;
    }
  }

  clear() {
    this.#active = false;
    clearTimeout(this.#currentTimeout);
  }
}
