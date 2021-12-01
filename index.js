console.log('[ENV] Loading environment variables');
require('dotenv').config();
console.log('[ENV] Loading CRON functions');
const { getWeather, getNOTAMs, getClosures, getLaunches } = require('./crons/loader');
const moment = require('moment');

// You might ask why the intervals are just shy of round numbers.
// This is to ensure a slowly rotating update interval.. i.e. a
// launch update will happen at 11:00, then just before 11:59,
// then just before 12:58, and so on. Over the course of several
// update periods, the trigger time rotates around the clock.
const WEATHER_DELAY = 3 * 60 * 1000 - 1000;  // Every 2 minutes, 59 seconds
const NOTAM_DELAY = 3 * 60 * 1000 - 1000;    // Every 2 minutes, 59 seconds
const CLOSURE_DELAY = 3 * 60 * 1000 - 1000;  // Every 2 minutes, 59 seconds
const LAUNCH_DELAY = 7 * 60 * 1000 - 1000;   // Every 6 minutes, 59 seconds
const IMMINENT_LAUNCH_DELAY = 20 * 60 * 1000 - 1000 // Every 19 minutes, 59 seconds

// Calibration parameters
const LAUNCH_REMINDER_TIME = 24 * 60 * 60 * 1000; // Post a reminder 24h ahead of a launch
const LAUNCH_IMMINENT_TIME = 3 * 60 * 60 * 1000; // Post a second reminder 3h ahead of a launch
const ERROR_REPORT_COOLDOWN = 12 * 60 * 60 * 1000 // Errors can be reported at most 2 twice a day

function time() {
    return new Date().toLocaleTimeString("en-US", {hour12: false, day: "2-digit", month: "2-digit"})
}

console.log('[ENV] Loading database functions');
const { Mongo, EnterMongo, ExitMongo } = require('./mongo');
// Weather is unconditionally updated!
async function updateWeather() {
    const started = moment().format('DD HH:mm');
    try {
        let weather = await getWeather();
        await EnterMongo();

        let collection = Mongo.db("weather").collection("nerdle");
        let result = await collection.findOneAndUpdate({_id: 'primaryWeather'}, {$set: weather}, {upsert: true});
        await postUpdate({
            type: 'weather',
            old: result.value,
            new: weather
        });
        console.log(`[${time()}] [MAIN] Weather update complete.`);
    } catch(err) {
        console.log(`[${time()}] [ERR] !! Error in weather update (started ${started}):`);
        console.error(err);
        handleError(err);
    } finally {
        await ExitMongo();
    }
}
// Update callbacks are executed only if there is something to report
async function updateNOTAMs(skipTopicUpdate) {
    const started = moment().format('DD HH:mm');
    try {
        let notams = await getNOTAMs();
        await EnterMongo();

        let collection = Mongo.db("notams").collection("tfrs");
        let wl_coll = Mongo.db("notams").collection("watching");

        for(let i = 0; i < notams.length; i++) {
            let notam = notams[i];
            notam.start = notam.start.format();
            notam.stop = notam.stop.format();
            let result = await collection.findOneAndUpdate({id: notam.id}, {$set: notam}, {upsert: true});
            let repost = await wl_coll.findOneAndUpdate({notam_id: notam.id}, {$set: {
                notam_id: notam.id,
                expires: notam.stop,
            }}, {upsert: true});
            repost = repost.lastErrorObject.updatedExisting === false;
            if(result.value) delete result.value._id;
            else result.value = {};
            if(!result.lastErrorObject.updatedExisting || JSON.stringify(notam) !== JSON.stringify(result.value)) {
                // There was a change!
                await postUpdate({
                    type: 'notam',
                    old: result.value,
                    new: notam
                });
                await new Promise((resolve, _) => setTimeout(resolve, 1000));
            } else if(repost) {
                await postUpdate({
                    type: 'notam',
                    old: 'repost',
                    new: notam
                });
            }
        }

        // Loop through the watch list and look for any NOTAMs that have been taken down before
        // their originally planned expiration, or have passed their expiration times.
        let watch_list = await Mongo.db("notams").collection("watching").find().toArray();
        const now = moment();
        for(let i = 0; i < watch_list.length; i++) {
            let watched = watch_list[i];
            if(now.isAfter(moment(watched.expires))) {
                // The expire deadline has past!
                await wl_coll.findOneAndDelete({notam_id: watched.notam_id});
                continue;
            }

            // The watched notam has not yet expired. If it's gone from the site, it
            // has been recalled -- something which should be announced.
            if(!notams.find(({id}) => id === watched.notam_id)) {
                let recalledNOTAM = await collection.findOne({id: watched.notam_id});
                await wl_coll.findOneAndDelete({notam_id: watched.notam_id});
                postUpdate({
                    type: 'notam',
                    old: recalledNOTAM,
                    new: {}
                });
                await new Promise((resolve, _) => setTimeout(resolve, 1000));
            }
        }

        SpaceBot.__updates.notam = moment().format('HH:mm');
        console.log(`[${time()}] [MAIN] NOTAM update complete. (Started ${started})`);
    } catch(err) {
        console.error(`[${time()}] [ERR] !! Error in NOTAM update (started ${started}):`);
        console.error(err);
        handleError(err);
    } finally {
        await ExitMongo();
    }
}
async function updateClosures(skipTopicUpdate) {
    const started = moment().format('DD HH:mm');
    try {
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
                if(moment().isAfter(closure.stop)) continue; // Skip update if it's for something in the past
                await postUpdate({
                    type: 'closure',
                    old: result.value,
                    new: closure
                });
                await new Promise((resolve, _) => setTimeout(resolve, 1000));
            }
        }
        SpaceBot.__updates.closure = moment().format('HH:mm');
        console.log(`[${time()}] [MAIN] Closure update complete. (Started ${started})`);
    } catch(err) {
        console.error(`[${time()}] [ERR] !! Error in closure update (started ${started}):`);
        console.error(err);
        handleError(err);
    } finally {
        await ExitMongo();
    }

}
async function updateLaunches(skipTopicUpdate) {
    const started = moment().format('DD HH:mm');
    try {
        let launches = await getLaunches();
        await EnterMongo();
        let collection = Mongo.db("launches").collection("launches");
        for(let i = 0; i < launches.length; i++) {
            let launch = launches[i];
            let result = await collection.findOneAndUpdate({mission: launch.mission}, {$set: launch}, {upsert: true});
            if(result.value) delete result.value._id;
            else result.value = {};
            if(!result.lastErrorObject.updatedExisting || JSON.stringify(launch) !== JSON.stringify(result.value)) {
                await postUpdate({
                    type: 'launch',
                    old: result.value,
                    new: launch
                });
                await new Promise((resolve, _) => setTimeout(resolve, 1000));
            }
        }
        SpaceBot.__updates.launch = moment().format('HH:mm');
        console.log(`[${time()}] [MAIN] Launch update complete. (Started ${started})`);
    } catch(err) {
        console.error(`[${time()}] [ERR] !! Error in launch update (started ${started}):`);
        console.error(err);
        handleError(err);
    } finally {
        await ExitMongo();
    }
}
async function fetchImminentLaunches() {
    const started = moment().format('DD HH:mm');
    try {
        await EnterMongo();
        let collection = Mongo.db("launches").collection("launches");
        let cursor = collection.find({
            "time.type": {
                $exists: true,
                $not: {
                    $eq: "undecided"
                }
            }
        });

        const now = moment();
        const remSubImm = LAUNCH_REMINDER_TIME - IMMINENT_LAUNCH_DELAY;
        const immSubImm = LAUNCH_IMMINENT_TIME - IMMINENT_LAUNCH_DELAY;
        while(await cursor.hasNext()) {
            const launch_data = await cursor.next();
            const timedelta = moment(launch_data.time.start) - now;

            // an alert is triggered if:
            //  a) a launch is less than LAUNCH_REMINDER_TIME in the future **AND** is at least (LAUNCH_REMINDER_TIME - IMMINENT_LAUNCH_DELAY) in the future
            //  b) a launch is less than LAUNCH_IMMINENT_TIME in the future **AND** is at least (LAUNCH_IMMINENT_TIME - IMMINENT_LAUNCH_DELAY) in the future
            const remRem = (timedelta < LAUNCH_REMINDER_TIME && timedelta > remSubImm);
            const immRem = (timedelta < LAUNCH_IMMINENT_TIME && timedelta > immSubImm);
            const needToAlert = remRem || immRem;

            if(needToAlert) {
                await postUpdate({
                    type: "launch-reminder",
                    old: immRem,
                    new: launch_data
                });
            }
        }
        console.log(`[${time()}] [MAIN] Imminent launch check complete. (Started ${started})`);
    } catch(err) {
        console.error(`[${time()}] [ERR] !! Error in imminent launch update (started ${started}):`);
        console.error(err);
        handleError(err);
    } finally {
        await ExitMongo();
    }
}

// Error report handling system
var lastErrorTime = 0;
function handleError(err) {
    const now = moment().valueOf();
    if((now - lastErrorTime) > ERROR_REPORT_COOLDOWN) {
        postUpdate({
            type: "error",
            old: null,
            new: err
        });
        lastErrorTime = now;
    }
}

console.log('[ENV] Loading discord bot');
const { SpaceBot, UPDATE_CHANNELS, CHANNEL_TOPICS } = require('./bot');
SpaceBot.on("ready", () => {

    console.log(`[${time()}] [MAIN] SpaceBot is ready!`)
    // console.log(`[${time()}] [MAIN] Running initial updates`);
    // Weather updates often enough to skip it on the initial iteration.
    // During development, doing this on every restart produces an unnecessary
    // amount of message spam in Discord. :(
    // updateWeather();
    setTimeout(() => updateNOTAMs(true), 1000);
    setTimeout(() => updateClosures(true), 6000);
    setTimeout(() => updateLaunches(true), 11000);
    setTimeout(() => fetchImminentLaunches(true), 2500);
    // Channel topics won't change the "updated at __:__" on the first run
});

async function postUpdate({type, old: old_data, new: new_data}) {
    let updates = [
        SpaceBot.receiveUpdate({
            type,
            old: old_data,
            new: new_data,
        }),
    ]
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
    await Promise.all(updates);
}

console.log('[ENV] Loading web server files');
const { WebServer } = require('./server');
console.log(`[${time()}] [HTTP] Launching web server...`);
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

var NOTAM_INTERVAL;
setTimeout(() => {
    NOTAM_INTERVAL = setInterval(() => {
        console.log(`[${time()}] [CRON] Starting NOTAM update...`);
        updateNOTAMs();
    }, NOTAM_DELAY);
}, 60000);

var CLOSURE_INTERVAL;
setTimeout(() => {
    CLOSURE_INTERVAL = setInterval(() => {
        console.log(`[${time()}] [CRON] Starting closure update...`);
        updateClosures();
    }, CLOSURE_DELAY);
}, 120000);

var LAUNCH_INTERVAL = setInterval(() => {
    console.log(`[${time()}] [CRON] Starting launch update...`);
    updateLaunches();
}, LAUNCH_DELAY);

var IMMINENT_LAUNCH_INTERVAL = setInterval(() => {
    console.log(`[${time()}] [CRON] Starting imminent launch check...`);
    fetchImminentLaunches();
}, IMMINENT_LAUNCH_DELAY);
