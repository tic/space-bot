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
    let today = luxon.local().setZone('UTC');
    try {
        let exact = await Mongo.db('launches').collection('launches').find({
            time: {$exists: true},
            'time.type': { $not: { $eq: 'undecided'} },
            'time.start': { $gt: today.toISO() },
        }).sort({ 'time.start': 1 }).toArray();

        let undecided = await Mongo.db('launches').collection('launches').find({
            time: { $exists: true },
            'time.type': { $eq: "undecided" },
        }).sort({ _id: 1}).toArray();

        var launches = { undecided, exact };
    } catch(err) { var launches = {undecided: [], exact: []}}


    // Options:
    // 1) TBD
    // 2) Month
    // 3) Month and Day
    // 4) ith Quarter
    // 5) Year
    const mos = ['January', 'February' , 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const abbmos = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
    // console.log(mos.indexOf('May'));

    launches.undecided = launches.undecided.sort((a, b) => {
        var ai = a.time.start;
        var bi = b.time.start;
        console.log(ai, bi);
        const aFirst = -1;
        const bFirst = aFirst * -1;
        if(ai === 'TBD') return bFirst;
        if(bi === 'TBD') return aFirst;

        var a_isMonth = false;
        var b_isMonth = false;
        for(let i = 0; i < abbmos.length; i++) {
            if(ai.indexOf(abbmos[i]) > -1) a_isMonth = mos[i];
            if(bi.indexOf(abbmos[i]) > -1) b_isMonth = mos[i];
        }

        if(a_isMonth !== false && b_isMonth !== false) {
            var am = mos.indexOf(a_isMonth);
            var bm = mos.indexOf(b_isMonth);

            if(am < bm) return aFirst;
            if(am > bm) return bFirst;
            // Both a and b the same month, potentially with dates

            var a_hasDay = false;
            var b_hasDay = false;

            if(/(\d\d?)/.test(ai)) a_hasDay = /(\d\d?)/.exec(ai)[0];
            if(/(\d\d?)/.test(bi)) b_hasDay = /(\d\d?)/.exec(bi)[0];

            if(a_hasDay !== false && b_hasDay === false) return aFirst;
            if(a_hasDay === false && b_hasDay !== false) return bFirst;
            if(a_hasDay !== false && b_hasDay !== false) {
                if(a_hasDay <= b_hasDay) return aFirst;
                return bFirst;
            }
            return 0;
        }

        var a_isQuarter = /\d[snrtdh]{2}/.test(ai) ? parseInt(/(\d)[snrtdh]{2}/.exec(ai)[0]) : false;
        var b_isQuarter = /\d[snrtdh]{2}/.test(bi) ? parseInt(/(\d)[snrtdh]{2}/.exec(bi)[0]) : false;

        if(a_isQuarter !== false && b_isQuarter !== false) {
            if(a_isQuarter <= b_isQuarter) return aFirst;
            return bFirst;
        }
        if(a_isMonth !== false && b_isQuarter !== false) {
            if(b_isQuarter * 4 - 3 <= a_isMonth) return bFirst;
            return aFirst;
        }
        if(a_isQuarter !== false && b_isMonth !== false) {
            if(a_isQuarter * 4 - 3 <= b_isMonth) return aFirst;
            return bFirst;
        }

        // Somewhere in here I need to add something to separate years.
        var a_yearPos = /^\w*-\d{4}$/.test(ai) ? /^(\w*)-\d{4}$/.exec(ai)[1] : false;
        var b_yearPos = /^\w*-\d{4}$/.test(bi) ? /^(\w*)-\d{4}$/.exec(bi)[1] : false;
        console.log("Y", a_yearPos, b_yearPos);

        if(a_yearPos === 'Early') {
            if(b_isMonth !== false) return b_isMonth > 3 ? aFirst : bFirst;
            if(b_isQuarter !== false) return b_isQuarter > 1 ? aFirst : bFirst;
            if(b_yearPos !== 'Early') return aFirst;
            else return bFirst;
        }
        if(a_yearPos === 'Mid') {
            if(b_isMonth !== false) return b_isMonth > 6 ? aFirst : bFirst;
            if(b_isQuarter !== false) return b_isQuarter > 2 ? aFirst : bFirst;
            if(b_yearPos === 'Mid' || b_yearPos === 'Late') return aFirst;
            else return bFirst;
        }
        if(a_yearPos === 'Late') {
            if(b_isMonth !== false) return b_isMonth > 9 ? aFirst : bFirst;
            if(b_isQuarter !== false) return b_isQuarter > 3 ? aFirst : bFirst;
            if(b_yearPos !== 'Late') return bFirst;
            else return aFirst;
        }

        if(b_yearPos === 'Early') {
            if(a_isMonth !== false) return a_isMonth > 3 ? bFirst : aFirst;
            if(a_isQuarter !== false) return a_isQuarter > 1 ? bFirst : aFirst;
            if(a_yearPos !== 'Early') return bFirst;
            else return aFirst;
        }
        if(b_yearPos === 'Mid') {
            if(a_isMonth !== false) return a_isMonth > 6 ? bFirst : aFirst;
            if(a_isQuarter !== false) return a_isQuarter > 2 ? bFirst : aFirst;
            if(a_yearPos === 'Mid' || a_yearPos === 'Late') return bFirst;
            else return aFirst;
        }
        if(b_yearPos === 'Late') {
            if(a_isMonth !== false) return a_isMonth > 9 ? bFirst : aFirst;
            if(a_isQuarter !== false) return a_isQuarter > 3 ? bFirst : aFirst;
            if(a_yearPos !== 'Late') return aFirst;
            else return bFirst;
        }

        console.log('unhandled case', ai, bi);
        return 0;
    });

    res.render('launches', {
        undecided: launches.undecided,
        exact: launches.exact,
    });
});

app.get('/upcheck', (req, res) => {
    res.send("Howdy, I'm still here!")
});

module.exports = {
    WebServer: app
}
