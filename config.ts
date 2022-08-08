import {
  config as dotenvConfig,
  DotenvConfigOutput,
} from 'dotenv';
import { GlobalConfigType } from './types/globalTypes';
import { discordServerConfig } from './discord.config.json';
import { DiscordServerType } from './types/serviceDiscordTypes';

export const getConfig = () : GlobalConfigType => {
  console.log('[CNFIG] Loading project configuration...');
  const { parsed: parsedEnv }: DotenvConfigOutput = dotenvConfig();
  if (parsedEnv === undefined) {
    throw new Error('failed to load environment file. does it exist?');
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
        intervalMs: parseInt(env('SCRAPER_INTERVALMS_BOOSTER'), 10),
        identifier: 'scraper_booster',
        url: env('SCRAPER_URL_BOOSTER'),
      },
      closures: {
        intervalMs: parseInt(env('SCRAPER_INTERVALMS_CLOSURES'), 10),
        identifier: 'scraper_closure',
        url: env('SCRAPER_URL_CLOSURES'),
      },
      launches: {
        intervalMs: parseInt(env('SCRAPER_INTERVALMS_LAUNCHES'), 10),
        identifier: 'scraper_launch',
        url: env('SCRAPER_URL_LAUNCHES'),
      },
      notams: {
        identifier: 'scraper_notam',
        url: env('SCRAPER_URL_NOTAMS'),
        intervalMs: parseInt(env('SCRAPER_INTERVALMS_NOTAMS'), 10),
        base: env('SCRAPER_URL_NOTAMS_BASE'),
      },
      weather: {
        intervalMs: parseInt(env('SCRAPER_INTERVALMS_WEATHER'), 10),
        identifier: 'scraper_weather',
        url: env('SCRAPER_URL_WEATHER'),
      },
    },
    discord: {
      secret: env('DISCORD_SECRET'),
      username: env('DISCORD_USERNAME'),
      servers: discordServerConfig as unknown as DiscordServerType[],
    },
    mongo: {
      url: env('MONGO_URL'),
      primaryDatabase: env('MONGO_PRIMARY_DATABASE'),
      username: env('MONGO_USERNAME'),
      password: env('MONGO_PASSWORD'),
    },
    web: {
      port: parseInt(env('WEB_PORT'), 10),
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

  console.log('[CNFIG] Configuration loaded.');
  return createdConfig;
};

export const config = getConfig();
