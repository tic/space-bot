import express = require('express');
import { config } from '../config';
import {
  BeachStatusEnum,
  NotamType,
  RoadClosureType,
  RocketLaunchTimeType,
  RocketLaunchType,
  WeatherDataType,
} from '../types/databaseModels';
import { closureBeachStatusToString } from '../types/scraperClosureTypes';
import { affiliationArray } from '../types/scraperLaunchTypes';
import { LogCategoriesEnum } from '../types/serviceLoggerTypes';
import { collections } from './database.service';
import { logError } from './logger.service';

// eslint-disable-next-line import/prefer-default-export
export const app = express();
app.use(express.static(`${__dirname}/../web/static`));
app.set('views', `${__dirname}/../web/views`);
app.set('view engine', 'pug');

app.get('/calendar-data', async (req, res) => {
  try {
    const rangeStart = new Date();
    rangeStart.setHours(0);
    rangeStart.setMinutes(0);
    rangeStart.setSeconds(0);
    rangeStart.setMilliseconds(0);
    rangeStart.setDate(-5);

    const rangeEnd = new Date();
    rangeEnd.setDate(14);
    rangeEnd.setHours(23);
    rangeEnd.setMinutes(59);
    rangeEnd.setSeconds(59);
    rangeEnd.setMilliseconds(999);
    rangeEnd.setMonth(rangeEnd.getMonth() + 1);

    const launchData = await collections.launches.find(
      { 'time.sortDate': { $gte: rangeStart.getTime(), $lte: rangeEnd.getTime() } },
      { sort: { 'time.sortDate': 1 } },
    ).toArray();

    res.json({ success: true, launches: launchData });
  } catch (error) {
    logError(LogCategoriesEnum.WEB_ERROR, config.web.identifier, error);
    res.json({ success: false });
  }
});

app.get('/calendar', async (req, res) => {
  try {
    res.render('calendar', { hideDiscord: true });
  } catch (error) {
    logError(LogCategoriesEnum.WEB_ERROR, config.web.identifier, error);
    res.render('calendar', {});
  }
});

app.get('/', async (req, res) => {
  const now = new Date();
  const closureDay = `${now.getMonth() + 1}\\.${now.getDate()}\\.${now.getFullYear()}`;

  try {
    const weather = (await collections.weather.findOne()) as WeatherDataType;
    const closures = ((await collections.roadClosures.find({
      closureCode: { $regex: `\\d+\\_${closureDay}` },
    }).toArray()) as RoadClosureType[]);
    closures.forEach((closure) => {
      // eslint-disable-next-line no-param-reassign
      closure.status = closureBeachStatusToString[closure.status] as BeachStatusEnum;
    });
    const notams = (await collections.notams.find({
      startDate: { $lt: now.getTime() },
      stopDate: { $gt: now.getTime() },
    }).toArray()) as NotamType[];

    res.render('today', {
      title: 'Today\'s Activities | Starbase',
      weather,
      closures,
      notams,
    });
  } catch (error) {
    logError(LogCategoriesEnum.WEB_ERROR, config.web.identifier, error);
    res.render('today', {
      title: 'Today\'s Activities | Starbase',
      weather: {
        wind: 0,
        humidity: '__',
        barometer: '__',
        barometerUnits: '__',
        temperature: '__',
        tempUnits: '&deg;F',
      },
      closures: [],
      notams: [],
    });
  }
});

app.get('/notams', async (req, res) => {
  try {
    const notams = await collections.notams.find({ stopDate: { $gt: new Date().getTime() } }).toArray() as NotamType[];
    res.render('notams', {
      title: 'TFRs | Starbase',
      notams: notams || [],
    });
  } catch (error) {
    logError(LogCategoriesEnum.WEB_ERROR, config.web.identifier, error);
    res.render('notams', {
      title: 'TFRs | Starbase',
      notams: [],
    });
  }
});

// app.get('/closures', async (req, res) => {
//   let closureDay = luxon.local().setZone('America/Chicago');
//   let dates = [...new Array(7)].map((_, i) => closureDay.plus({days: i}).toFormat('yyyy-MM-dd'));
//   try {
//     let events = await Mongo.db('closures').collection('road').find({
//         $or: dates.map((day, _) => ({day}))
//     }).toArray();
//     events.map((closure, _) => delete closure._id);
//     var closures = dates.map((date, _) => ({label: date, closures: events.filter(({day}) => date === day)}));
//   } catch (err) {
//     var closures = [];
//   }

//   res.render('closures', {
//       title: 'Closures | Starbase',
//       closures: closures ?? [],
//   });
// });

app.get('/launches', async (req, res) => {
  try {
    const now = new Date().getTime();
    const exact = await collections.launches.find({
      'time.type': { $ne: RocketLaunchTimeType.ESTIMATED },
      'time.startDate': { $gt: now },
    }).sort({ 'time.startDate': 1 }).toArray() as RocketLaunchType[];

    const undecided = await collections.launches.find({
      time: { $exists: true },
      'time.type': RocketLaunchTimeType.ESTIMATED,
      'time.startDate': { $gt: now },
    }).sort({ 'time.startDate': 1 }).toArray() as RocketLaunchType[];

    res.render('launches', {
      title: 'Upcoming Launches',
      exact: exact.map((launchData) => ({
        ...launchData,
        affiliations: launchData.affiliations.map(
          (affiliation) => affiliationArray.find((item) => item.group === affiliation).tag,
        ),
      })),
      undecided: undecided.map((launchData) => ({
        ...launchData,
        affiliations: launchData.affiliations.map(
          (affiliation) => affiliationArray.find((item) => item.group === affiliation).tag,
        ),
      })),
    });
  } catch (error) {
    logError(LogCategoriesEnum.WEB_ERROR, config.web.identifier, error);
    res.render('launches', {
      title: 'Upcoming Launches',
      undecided: [],
      exact: [],
    });
  }
});

app.get('/upcheck', (_, res) => {
  res.send("Howdy, I'm still here!");
});
