import express = require('express');
import {
  BeachStatusEnum,
  NotamType,
  RoadClosureType,
  WeatherDataType,
} from '../types/databaseModels';
import { closureBeachStatusToString } from '../types/scraperClosureTypes';
import { collections } from './database.service';

// eslint-disable-next-line import/prefer-default-export
export const app = express();
app.use(express.static(`${__dirname}/../web/static`));
app.set('views', `${__dirname}/../web/views`);
app.set('view engine', 'pug');

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
  } catch {
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

// app.get('/notams', async (req, res) => {
//   var notams = [];
//   try {
//     let notam_ids = ((
//       await Mongo.db('notams').collection('watching').find().toArray()
//     ) || []).map(({notam_id}) => notam_id);
//     notams = await Mongo.db('notams').collection('tfrs').find({$or: notam_ids.map(id => ({id}))}).toArray();
//   } catch(err) {}

//   res.render('notams', {
//     title: 'TFRs | Starbase',
//     notams: notams ?? [],
//   });
// });

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

// app.get('/launches', async (req, res) => {
//   let today = luxon.local().setZone('UTC');
//
//   try {
//     let exact = await Mongo.db('launches').collection('launches').find({
//       time: {$exists: true},
//       'time.type': { $not: { $eq: 'undecided'} },
//       'time.start': { $gt: today.toISO() },
//     }).sort({ 'time.start': 1 }).toArray();

//     let undecided = await Mongo.db('launches').collection('launches').find({
//       time: { $exists: true },
//       'time.type': { $eq: "undecided" },
//     }).sort({ _id: 1}).toArray();

//     var launches = {
//       undecided,
//       exact,
//     };
//   } catch (err) {
//     var launches = {
//       undecided: [],
//       exact: []
//     };
//   }

//   res.render('launches', {
//     title: 'Upcoming Launches',
//     undecided: launches.undecided,
//     exact: launches.exact,
//   });
// });

app.get('/upcheck', (_, res) => {
  res.send("Howdy, I'm still here!");
});
