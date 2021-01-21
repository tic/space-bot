require('dotenv').config();
const { getWeather, getNOTAMs, getClosures } = require('./crons/loader');
const moment = require('moment');

var WEATHER_DELAY = 11 * 60 * 1000;
var NOTAM_DELAY = 31 * 60 * 1000;
var CLOSURE_DELAY = 29 * 60 * 1000;

function time() {
    return new Date().toLocaleTimeString("en-US", {hour12: false, day: "2-digit", month: "2-digit"})
}

const { Mongo, EnterMongo, ExitMongo } = require('./mongo');
// Weather is unconditionally updated!
async function updateWeather() {
    let weather = await getWeather();
    await EnterMongo();

    let collection = Mongo.db("weather").collection("nerdle");
    let result = await collection.findOneAndUpdate({_id: 'primaryWeather'}, {$set: weather}, {upsert: true});
    postUpdate({
        type: 'weather',
        old: result.value,
        new: weather
    });
    await ExitMongo();
    console.log(`[${time()}] [MAIN] Weather update complete.`);
}
// Update callbacks are executed only if there is something to report
async function updateNOTAMs() {
    let notams = await getNOTAMs();
    await EnterMongo();

    let collection = Mongo.db("notams").collection("tfrs");
    for(let i = 0; i < notams.length; i++) {
        let notam = notams[i];
        notam.start = notam.start.format();
        notam.stop = notam.stop.format();
        let result = await collection.findOneAndUpdate({id: notam.id}, {$set: notam}, {upsert: true});
        if(result.value) delete result.value._id;
        else result.value = {}
        if(!result.lastErrorObject.updatedExisting || JSON.stringify(notam) !== JSON.stringify(result.value)) {
            // There was a change!
            postUpdate({
                type: 'notam',
                old: result.value,
                new: notam
            });
            await new Promise((resolve, _) => setTimeout(resolve, 1000));
        }
    }

    await ExitMongo();
    for(let i = 0; i < UPDATE_CHANNELS.notam.length; i++) {
        await SpaceBot.channels.cache.get(UPDATE_CHANNELS.notam[i]).setTopic(`${CHANNEL_TOPICS['notam']} | Updated at ${moment().format('HH:mm')} EST`);
        await new Promise((resolve, _) => setTimeout(resolve, 1000));
    }
    console.log(`[${time()}] [MAIN] NOTAM update complete.`);
}
async function updateClosures() {
    let closures = await getClosures();
    await EnterMongo();

    let collection = Mongo.db("closures").collection("road");
    for(let i = 0; i < closures.length; i++) {
        let closure = closures[i];
        closure = Object.assign({day: closure.start.format('YYYY-MM-DD')}, closure);
        closure.start = closure.start.format();
        closure.stop = closure.stop.format();
        let result = await collection.findOneAndUpdate({day: closure.day}, {$set: closure}, {upsert: true});
        if(result.value) delete result.value._id;
        else result.value = {};
        if(!result.lastErrorObject.updatedExisting || JSON.stringify(closure) !== JSON.stringify(result.value)) {
            // Either something new was added to the database, or a previously existing
            // item was modified.
            postUpdate({
                type: 'closure',
                old: result.value,
                new: closure
            });
        }
    }
    await ExitMongo();
    for(let i = 0; i < UPDATE_CHANNELS.closure.length; i++) {
        await SpaceBot.channels.cache.get(UPDATE_CHANNELS.closure[i]).setTopic(`${CHANNEL_TOPICS['closure']} | Updated at ${moment().format('HH:mm')} EST`);
        await new Promise((resolve, _) => setTimeout(resolve, 1000));
    }
    console.log(`[${time()}] [MAIN] Closure update complete.`);
}

const { SpaceBot, UPDATE_CHANNELS, CHANNEL_TOPICS } = require('./bot');
SpaceBot.on("ready", () => {
    console.log(`[${time()}] [MAIN] Running initial updates`);
    // Weather updates often enough to skip it on the initial iteration.
    // During development, doing this on every restart produces an unnecessary
    // amount of message spam in Discord. :(
    // updateWeather();
    updateNOTAMs();
    updateClosures();
});

async function postUpdate({type, old: old_data, new: new_data}) {
    SpaceBot.receiveUpdate({
        type,
        old: old_data,
        new: new_data,
    });
    switch(type) {
        case 'wind':
            break;

        case 'notam':
            // console.log(old_data);
            // console.log(new_data);
            break;

        case 'closure':
            // console.log(old_data);
            // console.log(new_data);
            break;
    }
}

const { WebServer } = require('./server');
WebServer.listen(process.env.PORT, err => {
    if(err) {
        console.log(`[${time()}] [HTTP] !! Failed to start webserver on port ${process.env.PORT}.\n${err}`);
        return;
    }
    console.log(`[${time()}] [HTTP] Web server started on port ${process.env.PORT}`);
});

var WEATHER_INTERVAL = setInterval(() => {
    console.log(`[${time()}] [CRON] Starting weather update...`);
    updateWeather();
}, WEATHER_DELAY);
var NOTAM_INTERVAL = setInterval(() => {
    console.log(`[${time()}] [CRON] Starting NOTAM update...`);
    updateNOTAMs()
}, NOTAM_DELAY);
var CLOSURE_INTERVAL = setInterval(() => {
    console.log(`[${time()}] [CRON] Starting closure update...`);
    updateClosures();
}, CLOSURE_DELAY);
