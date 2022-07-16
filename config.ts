import {
  config as dotenvConfig,
  DotenvConfigOutput,
} from 'dotenv';
import { GlobalConfigType } from './types/globalTypes';

export const getConfig = () : GlobalConfigType => {
  console.log('[CNFIG] Loading project configuration');
  const { parsed: parsedEnv }: DotenvConfigOutput = dotenvConfig();
  console.log(parsedEnv);
  if (parsedEnv === undefined) {
    throw new Error();
  }
  const missingKeys: string[] = [];
  function env(key: string) {
    if (key === '') {
      return '';
    }
    const value = parsedEnv?.[key];
    if (value === undefined) {
      missingKeys.push(key);
      return '';
    }
    return value;
  }

  const createdConfig: GlobalConfigType = {
    scrapers: {
      boosters: {
        url: env('SCRAPER_URL_BOOSTER'),
      },
      closures: {
        url: env('SCRAPER_URL_CLOSURES'),
      },
      launches: {
        url: env('SCRAPER_URL_LAUNCHES'),
      },
      notams: {
        url: env('SCRAPER_URL_NOTAMS'),
      },
      weather: {
        url: env('SCRAPER_URL_WEATHER'),
      },
    },
    discord: {
      secret: env('DISCORD_SECRET'),
      username: env('DISCORD_USERNAME'),
    },
    mongo: {
      url: env('MONGO_URL'),
      port: parseInt(env('MONGO_PORT'), 10) || 0,
      username: env('MONGO_USERNAME'),
      password: env('MONGO_PASSWORD'),
    },
  };

  if (missingKeys.length > 0) {
    console.warn(
      '[CNFIG] Global configuration referenced missing environment variables:\n\t- %s',
      missingKeys.join('\n\t- '),
    );
    console.error('[CNFIG] The project cannot continue with an incomplete configuration. Exiting...');
    process.exit(1);
  }

  return createdConfig;
};

export const config = getConfig();
