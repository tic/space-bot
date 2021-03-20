const http = require('http');
const express = require('express');
const app = new express();
const luxon = require('luxon').DateTime;

const { Mongo, EnterMongo, ExitMongo } = require('./mongo');

app.use(express.static(`${__dirname}/static`));
app.set('views', `${__dirname}/views`);
app.set('view engine', 'pug');

app.get('/', async (req, res) => {
    // Create filter for closures
    let closureDay = luxon.local().setZone('America/Chicago').toFormat('yyyy-MM-dd');

    try {
        var weather = await Mongo.db('weather').collection('nerdle').findOne({_id: 'primaryWeather'});
        var closures = await Mongo.db('closures').collection('road').find({day: closureDay}).toArray();
        var flightRestrictions = await Mongo.db('notams').collection('tfrs').find({
            $or: (await Mongo.db('notams').collection('watching').find().toArray()).map(({notam_id}) => ({id: notam_id}))
        }).toArray();
    } catch(err) {}

    res.render('today', {
        weather: weather ?? {
            wind: 0,
            humidity: '__',
            barometer: '__',
            barometerUnits: '__',
            temperature: '__',
            tempUnits: '&deg;F'
        },
        closures: closures ?? [],
        flightRestrictions: flightRestrictions ?? [],
    });
});

app.get('/notams', async (req, res) => {
    var notams = [];
    try {
        let notam_ids = ((await Mongo.db('notams').collection('watching').find().toArray()) || []).map(({notam_id}) => notam_id);
        notams = await Mongo.db('notams').collection('tfrs').find({$or: notam_ids.map(id => ({id}))}).toArray();
    } catch(err) {}

    res.render('notams', {
        notams: notams ?? [],
    });
});

app.get('/closures', async (req, res) => {
    let closureDay = luxon.local().setZone('America/Chicago');
    let dates = [...new Array(7)].map((_, i) => closureDay.plus({days: i}).toFormat('yyyy-MM-dd'));
    try {
        let events = await Mongo.db('closures').collection('road').find({
            $or: dates.map((day, _) => ({day}))
        }).toArray();
        events.map((closure, _) => delete closure._id);
        var closures = dates.map((date, _) => ({label: date, closures: events.filter(({day}) => date === day)}));
    } catch(err) { var closures = []; }

    res.render('closures', {
        closures: closures ?? [],
    });
});

app.get('/launches', async (req, res) => {

});

app.get('/upcheck', (req, res) => {
    res.send("Howdy, I'm still here!")
});

module.exports = {
    WebServer: app
}
