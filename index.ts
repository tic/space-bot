import BoosterScraperController from './scrapers/boosters';
import ClosureScraperController from './scrapers/closures';
import LaunchScraperController from './scrapers/launches';
import NotamScraperController from './scrapers/notams';
import WeatherScraperController from './scrapers/weather';
import { config } from './config';
import { client } from './services/database.service';
import {
  setIntervalAndStart,
  wrapScraperHandler,
} from './services/util';

client.connect();

const keysToControllers = {
  boosters: BoosterScraperController,
  closures: ClosureScraperController,
  launches: LaunchScraperController,
  notams: NotamScraperController,
  weather: WeatherScraperController,
};

Object.entries(keysToControllers).forEach(([key, controller]) => {
  setIntervalAndStart(
    wrapScraperHandler(config.scrapers[key].identifier, controller),
    config.scrapers[key].intervalMs,
  );
});
