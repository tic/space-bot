require('dotenv').config();
const { getWeather, getNOTAMs, getClosures } = require('./crons/loader');

var WEATHER_DELAY = 11 * 60 * 1000;
var NOTAM_DELAY = 31 * 60 * 1000;
var CLOSURE_DELAY = 29 * 60 * 1000;

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
    console.log(`[MAIN] Weather update complete.`);
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
    console.log(`[MAIN] NOTAM update complete.`);
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
    console.log(`[MAIN] Closure update complete.`);
}

const { SpaceBot } = require('./bot');
SpaceBot.on("ready", () => {
    console.log(`[MAIN] Running initial updates`);
    updateWeather();
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
        console.log(`[HTTP] !! Failed to start webserver on port ${process.env.PORT}.\n${err}`);
        return;
    }
    console.log(`[HTTP] Web server started on port ${process.env.PORT}`);
});

var WEATHER_INTERVAL = setInterval(() => {
    console.log('[CRON] Starting weather update...');
    updateWeather();
}, WEATHER_DELAY);
var NOTAM_INTERVAL = setInterval(() => {
    console.log('[CRON] Starting NOTAM update...');
    updateNOTAMs()
}, NOTAM_DELAY);
var CLOSURE_INTERVAL = setInterval(() => {
    console.log('[CRON] Starting closure update...');
    updateClosures();
}, CLOSURE_DELAY);
