import { appendFile } from 'fs';
import { LogCategoriesEnum } from '../types/serviceLoggerTypes';

const getTimeString = () : string => {
  const now = new Date();
  const twoDigitPad = (value: number) : string => (value < 10 ? `0${value}` : value.toString());
  return `${
    twoDigitPad(now.getFullYear())
  }.${
    twoDigitPad(now.getMonth() + 1)
  }.${
    twoDigitPad(now.getDate())
  }T${
    twoDigitPad(now.getHours())
  }:${
    twoDigitPad(now.getMinutes())
  }:${
    twoDigitPad(now.getSeconds())
  }`;
};

const getErrorString = (errorStringIn?: string, errorIn?: Error) => {
  const pieces = [];
  if (errorStringIn) {
    pieces.push(`message: ${errorStringIn}`);
  }

  if (errorIn) {
    pieces.push(`trace: ${errorIn.stack.replace(/\n/g, '+>')}`);
  }

  if (pieces.length === 2) {
    return pieces.join('. ');
  }

  return pieces[0] || '';
};

// [time]|[log version]|[category]|[source]|[message]
const logFormat = '%s|%s|%s|%s|%s';
const logVersion = 'v1.0.1';

export const interpretLogLine = (logLine: string) : void => {
  const logPieces = logLine.split('|');
  if (logPieces[1] === 'v1.0.0') {
    if (logPieces.length !== 4) {
      console.log('Incorrectly formatted log message with version v1.0.0');
    } else {
      console.log(
        'Timestamp: %s\nLog version: %s\nCategory: %s\nSource: %s\nMessage: %s',
        logPieces[0],
        logPieces[1],
        logPieces[2],
        logPieces[3],
        logPieces[4],
      );
    }
  } else if (logPieces[1] === 'v1.0.1') {
    if (logPieces.length !== 4) {
      console.log('Incorrectly formatted log message with version v1.0.1');
    } else {
      console.log(
        'Timestamp: %s\nLog version: %s\nCategory: %s\nSource: %s\nMessage: %s',
        logPieces[0],
        logPieces[1],
        logPieces[2],
        logPieces[3],
        logPieces[4].replace(/\+>\s+/g, '\n\t'),
      );
    }
  } else {
    console.log('Unsupported log format/version.');
  }
};

export const logError = async (
  category: LogCategoriesEnum,
  source: string,
  errorIn?: Error,
  errorStringIn?: string,
) : Promise<boolean> => {
  const timeStr = getTimeString();
  const assembledMessage = [
    timeStr,
    logVersion,
    category,
    source,
    getErrorString(errorStringIn, errorIn),
  ]
    .reduce((msg, content) => msg.replace('%s', content), logFormat);

  console.log(assembledMessage);
  return new Promise((resolve) => {
    appendFile(
      `./logs/${timeStr.substring(0, 7)}.spacebotlog.txt`,
      `${assembledMessage}\n`,
      (writeErr) => {
        resolve(writeErr === null);
      },
    );
  });
};

export const logMessage = async (source: string, message: string) : Promise<boolean> => {
  const timeStr = getTimeString();
  const assembledMessage = [
    timeStr,
    logVersion,
    LogCategoriesEnum.STATUS_LOG,
    source,
    message || '',
  ]
    .reduce((msg, content) => msg.replace('%s', content), logFormat);

  console.log(assembledMessage);
  return new Promise((resolve) => {
    appendFile(
      `./logs/${timeStr.substring(0, 7)}.spacebotlog.txt`,
      `${assembledMessage}\n`,
      (writeErr) => {
        resolve(writeErr === null);
      },
    );
  });
};
