import BoosterScraperController from './scrapers/boosters';
// import ClosureScraperController from './scrapers/closures';
import LaunchScraperController from './scrapers/launches';
import NotamScraperController from './scrapers/notams';
import WeatherScraperController from './scrapers/weather';
import { config } from './config';
import { client } from './services/database.service';
import {
  setIntervalAndStart,
  wrapScraperHandler,
} from './services/util';
import {
  ScraperControllerType,
  ScraperName,
} from './types/globalTypes';
import { initialize } from './services/discord.service';
import { app } from './services/webserver.service';
import { logMessage } from './services/logger.service';

client.connect();
initialize();

const keysToControllers: Record<string, ScraperControllerType> = {
  boosters: BoosterScraperController,
  // closures: ClosureScraperController,
  launches: LaunchScraperController,
  notams: NotamScraperController,
  weather: WeatherScraperController,
};

Object.entries(keysToControllers).forEach(([_key, controller]) => {
  const key = _key as ScraperName;
  setIntervalAndStart(
    wrapScraperHandler(config.scrapers[key].identifier, controller),
    config.scrapers[key].intervalMs,
  );
});

app.listen(config.web.port, () => {
  logMessage('service.webserver.initialize', 'Web server is listening for requests.');
});
