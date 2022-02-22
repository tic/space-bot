const fetch = require('node-fetch');
const JSSoup = require('jssoup').default;
const moment = require('moment-timezone');
const he = require('he');
const { WEATHER, NOTAMS, NOTAMBASE, CLOSURES, LAUNCHES } = process.env;
const AFFILIATIONS = [
    { tag: 'Rocket Lab', group: 'RocketLab' },
    { tag: 'SpaceX', group: 'SpaceX' },
    { tag: 'Russia', group: 'Russia' },
    { tag: 'Northrop Grumman', group: 'NG' },
    { tag: 'United Launch Alliance', group: 'ULA' },
    { tag: 'India', group: 'India' },
    { tag: 'Arianespace', group: 'Arianespace' },
    { tag: 'U.S. Air Force', group: 'USAF' },
    { tag: 'USAF', group: 'USAF' },
    { tag: 'U.S. Space Force', group: 'USSF' },
    { tag: 'USSF', group: 'USSF' },
    { tag: 'Astra', group: 'Astra' },
    { tag: 'Japanese', group: 'Japan' },
    { tag: 'Japan', group: 'Japan' },
    { tag: 'International Space Station', group: 'ISS' },
    { tag: 'Space Launch System', group: 'SLS' },
    { tag: 'SLS', group: 'SLS' },
];

async function getWeather() {
    return await (await fetch(WEATHER)).json();
}

function getNOTAMURL(id) {
    return `${NOTAMBASE}/save_pages/detail_${id.replace('/', '_')}.html`;
}
async function getNOTAMs() {
    const content = await (await fetch(NOTAMS, {method: 'POST'}).catch(err => {
        console.error(err);
        return {text: () => ''};
    })).text();
    const soup = new JSSoup(content);
    let [ notam_table ] = soup.findAll('table')
        .filter(({attrs: {width}}) => width == 970);
    let notams = notam_table.findAll('tr')
        .filter(({attrs: {valign, height}}) => valign === "top" && height == 40)
        .map(async tr => {
            // Checks that cell.find('a') actually finds something, since NOTAMs which lack
            // a zoom-in button also lack an <a> tag in their last column, which would cause
            // the string conversion two lines below to fail otherwise.
            let [posted, notam_id, facility, state, type, description] = tr.findAll('td')
                .map(cell => cell.find('a') ? cell.find('a').contents.toString() : '');
            if(type !== "SPACE OPERATIONS" || (description.indexOf('Brownsville') === -1 && description.indexOf('Boca Chica') === -1)) return null;

            notam_id = (new JSSoup(notam_id)).find('u').contents.toString()
            let link = getNOTAMURL(notam_id);

            const tfr_data = await (await fetch(link).catch(err => {
                console.error(err);
                return {text: () => ''};
            })).text();
            const tfr_soup = new JSSoup(tfr_data);

            let detail_table = tfr_soup.findAll('table')
                .filter(({attrs: {width, summary}}) => !summary && width == 830)[0]
                .nextElement.nextElement.nextElement.findNextSibling();

            let details = detail_table.findAll('TR');
            details = details.map(tr => {
                let f = tr.find('font')
                return f ? f.contents.toString() : null;
            });

            let m_start = moment.utc(details[details.length - 3].substring(4), "MMMM DD, YYYY at HHmm UTC");
            let m_stop = moment.utc(details[details.length - 2].substring(2), "MMMM DD, YYYY at HHmm UTC");

            // strange moment parsing behavior.. incorrectly parses 1200 as 00:00
            // this is a tiny amount of stuff to make sure that error doesn't happen
            if(m_start.hour() === 0 && details[details.length - 3].indexOf('1200') > -1)
                m_start.hour(12);
            if(m_stop.hour() === 0 && details[details.length - 3].indexOf('1200') > -1)
                m_stop.hour(12);

            let rawAltitude = detail_table.contents.toString().match(/(\d+) feet MSL/);
            let altitude = 'Unlimited';
            if(rawAltitude) altitude = rawAltitude[1];

            let image = tfr_soup.findAll('table')
                .map(table => {
                    let img = table.find('img');
                    if(img) return img.attrs.src;
                    return null;
                }).filter(img => img && img.indexOf('save_maps') > -1);

            return {
                id: notam_id,
                altitude: altitude ?? 'N/A',
                image: `${NOTAMBASE}${image}`,
                link,
                start: m_start,
                stop: m_stop,
            };
        });

    notams = (await Promise.all(notams))
        .filter(_ => _); // shorthand notation to remove null entries

    return notams;
}

function replaceAll(str, term, replacement) {
    while(str.indexOf(term) > -1) str = str.replace(term, replacement);
    return str;
}
async function learn(args) {
    let script_results = new Promise((resolve, reject) => {
        var { PythonShell } = require('python-shell');
        const SCRIPT_PATH = 'extract_info.py';

        var options = {
            mode: 'text',
            args, //['-s "10:30 a.m. to 11:30 p.m."']
        };

        const duration_timeout = setTimeout(() => reject('{error: true, message: maximum time exceeded}'), args.length * 5000);

        PythonShell.run(SCRIPT_PATH, options, function (err, results) {
            clearTimeout(duration_timeout);
            if (err) reject(err);
            // results is an array consisting of messages collected during execution
            resolve(results);
        });
    });

    return await script_results;
}
async function getClosures() {

    const content = await (await fetch(CLOSURES).catch(err => {
        console.error(err);
        return {text: () => ''};
    })).text();
    const soup = new JSSoup(content);
    // body of the first table
    let closure_table = soup.find('table').find('tbody');
    let closures = closure_table.findAll('tr')
    .map(row => {
        let [type, date, time, status] = row.findAll('td')
            .map(cell => cell.contents);
        if(type == '' || date == '' || time == '' || status == '') return null;
        return {
            type: type.toString(),
            date: date.toString(),
            time: time.toString(),
            status: status.toString()
        }
    });

    args = [];
    for(let i = 0; i < closures.length; i++) {
        args.push(`-s ${closures[i].time}`);
        args.push(`-s ${closures[i].date}`);
    }

    let smart_times = (await learn(args)).filter((_, i) => i % 2).map(result => JSON.parse(replaceAll(result, "'", '"').replace(/\]\[/g,"],[")));
    if(smart_times.error) return [];
    for(let i = 0; i < smart_times.length; i += 2) {
        delete closures[i / 2].time;
        delete closures[i / 2].date;
        closures[i / 2].status = replaceAll(replaceAll(replaceAll(replaceAll(closures[i / 2].status, '<br />', ' '), ',', ''), '\n', ''), '&amp;', '&');
        const m = moment(smart_times[i + 1][0], 'dddd, MMMM DD, YYYY').hour(23).tz('America/Chicago');
        const [start, stop] = smart_times[i];
        if(start[1] === 'TIME') {
            const detected = moment(start[0], 'h:mm a');
            closures[i / 2].start = moment(m).hour(detected.hour()).minute(detected.minute());
        }
        if(stop[1] === 'TIME') {
            const detected = moment(stop[0], 'h:mm a');
            closures[i / 2].stop = moment(m).hour(detected.hour()).minute(detected.minute());
        }

        closures[i / 2] = {
            start: closures[i / 2].start,
            status: closures[i / 2].status,
            stop: closures[i / 2].stop,
            type: closures[i / 2].type
        }
    }

    if(closures.length > 1) {
        let last = closures[0].start.format('MM/DD/YYYY');
        for(let i = 1; i < closures.length; i++) {
            let temp = closures[i].start.format('MM/DD/YYYY');
            if(last === temp) {
                closures[i] = false;
            }
            last = temp;
        }
    }

    return closures.filter(_ => _);
}

function getAffiliations(description) {
    return [...new Set(AFFILIATIONS
        .filter(({tag}) => description.indexOf(tag) > -1)
        .map(({group}) => group))];
}
function cleanTime(date, time) {
    const MonthAbbrevs = {'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August', 'Sept': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'};
    function detectTime(time, day, month) {
        let sec = 0;
        var t = parseInt(time);
        if(time.indexOf(":") > -1) {
            t = parseInt(time.split(":")[0]);
            sec = parseInt(time.split(":")[1]);
        }
        const hour = parseInt(t / 100);
        const min = t % 100;
        let m = moment().tz('GMT').month(month).date(day).hour(hour).minute(min).second(sec);
        return m.format();
    }

    var [day, month] = ['', '']
    try {
        if(date.indexOf('/') > -1) {
            let [d1, d2] = date.split('/');
            // Second date contains month and day
            let n2 = parseInt(d2);
            if(isNaN(n2)) {
                [month, day] = d2.split(' ');
                day = parseInt(day);
            }
            else {
                month = d1.split(' ')[0];
                day = n2;
            }

            // Month is abbreviated
            if(month.indexOf('.') > -1) month = MonthAbbrevs[month.substring(0, month.indexOf('.'))];
        } else {

            if(/^[A-Za-z\.]+ \d+$/.test(date)) {
                [month, day] = date.split(' ');
                if(month.indexOf('.') > -1) month = MonthAbbrevs[month.substring(0, month.indexOf('.'))];
                day = parseInt(day)
            } else {
                month = null;
                day = null;
            }
        }
    } catch(err) {
        console.log('Date err: ' + err.toString())
        return { type: 'unknown', start: null, stop: null }
    }

    if(/TBD/i.test(time)) {
        return { type: 'undecided', start: date, stop: null }
    } else {
        try {
            let type = 'unknown';
            if(/^\d{4} GMT/.test(time)) type = 'exact';
            else if(/^\d{4}:\d{2} GMT/.test(time)) type = 'exact-second';
            else if(/\d{4}-\d{4} GMT/.test(time)) type = 'window';
            else if(/^\d{4}:\d{2}-\d{4}:\d{2} GMT/.test(time)) type = 'exact-second-window';
            else if(/Approx. \d{4}/i.test(time)) type = 'approximate';
            else if(/\d{4} or \d{4} GMT/i.test(time)) type = 'flexible'

            if(type === 'unknown') throw new Error('unknown date format "' + time + '"')
            if(month === null || day === null)
                return { type: 'undecided', start: date, stop: null };
            var [start, stop] = [null, null];
            if(type === 'window') {
                //  Need to parse out start and stop times
                cap = /(\d{4})-(\d{4}) GMT/.exec(time);
                start = detectTime(cap[1], day, month);
                stop = detectTime(cap[2], day, month);
            } else if(type === 'flexible') {
                // Parse out first and second time possibilities
                cap = /(\d{4}) or (\d{4}) GMT/i.exec(time);
                start = detectTime(cap[1], day, month);
                stop = detectTime(cap[2], day, month);
            } else if(type === 'exact-second') {
                cap = /(\d{4}):(\d{2}) GMT/.exec(time);
                start = detectTime(cap[1], day, month);
                start = moment(start).second(parseInt(cap[2])).format();
                type ='exact';
            } else if(type === 'exact-second-window') {
                //  Need to parse out start and stop times
                cap = /^(\d{4}:\d{2})-(\d{4}:\d{2}) GMT/.exec(time);
                start = detectTime(cap[1], day, month);
                stop = detectTime(cap[2], day, month);
            } else {
                // Just need to parse out the start time
                cap = /(\d{4}) GMT/.exec(time);
                if(!cap) {
                    cap = /(\d{4}:\d{2}) GMT/.exec(time);
                }
                start = detectTime(cap[1], day, month);
            }

            return { type, start, stop}
        } catch(err) {
            console.log('Time err: ' + err.toString())
            return { type: 'unknown', start: null, stop: null }
        }
    }
}

async function getLaunches() {
    const content = await (await fetch(LAUNCHES).catch(err => {
        console.error(err);
        return {text: () => ''};
    })).text();
    const soup = new JSSoup(content);
    let launch_container = soup.find('article')
        .nextElement
        .findNextSibling();

    let mission_pieces = launch_container.findAll('div');
    let launches = [];
    let missions = [];
    for(let i = 0; i < mission_pieces.length - 2; i += 3) {
        // Date + vehicle + mission are in the first block
        let [ date, vmiss ] = mission_pieces[i].findAll('span')
            .map(_ => he.decode(_.contents.toString()));
        let [ vehicle, mission ] = vmiss.split(' • ');

        if(missions.indexOf(mission) > -1) continue;
        missions.push(mission);

        // Window + site are in the second block
        let [ launch_win, launch_site ] = mission_pieces[i + 1].findAll('span');
        launch_win = launch_win.nextElement.nextElement.toString().trim();
        launch_site = launch_site.nextElement.nextElement.nextElement.toString().trim();

        // Affiliation + description are in the third block
        let description = mission_pieces[i + 2].nextElement.toString();
        let desc2 = mission_pieces[i + 2].nextElement.nextElement.nextElement;
        if(desc2._text) {
            description += desc2._text;
            description += desc2.nextElement._text;
        }
        description = he.decode(description);

        let affiliations = getAffiliations(description);

        let cleaned_time = cleanTime(date, launch_win);

        launches.push({
            mission,
            affiliations,
            date,
            description,
            launch_site,
            vehicle,
            window: launch_win,
            time: cleaned_time,
        });
    }
    return launches;
}

async function getF9Boosters() {
    const content = await (await fetch('https://en.wikipedia.org/wiki/List_of_Falcon_9_first-stage_boosters').catch(err => {
        console.error(err);
        return {text: () => null};
    })).text();
    if(content === null) {
        return [];
    }
    const now = moment();

    let boosters = [];
    const soup = new JSSoup(content);
    let boostersRaw = soup.find('table').findAll('tr').splice(1);
    for(let i = 0; i < boostersRaw.length; i++) {
        const boosterData = boostersRaw[i].findAll('td');

        // Find the operative data row (with the latest landing information)
        let j = i + 1;
        for(; j < boostersRaw.length; j++) {
            let data = boostersRaw[j].find('td');
            if(data.text.match(/B\d{4}/)) {
                i = j - 1;
                break;
            }
        }

        if(j === boostersRaw.length) {
            i = boostersRaw.length - 1;
        }

        // Process/clean booster data
        launchData = boostersRaw[i].findAll('td');

        // Process launch date
        let boosterLaunch = launchData[launchData.length === 10 ? 3 : launchData.length === 7 ? 1 : 0].text.replace(/[\n\t]/g, '');
        if(boosterLaunch)
        if(/not yet known/i.test(boosterLaunch)) {
            // If the booster isn't scheduled to fly, there is no point in
            //   recording it, since it can't be matched with a mission w/o an
            //   assigned mission date.
            continue;
        } else if(boosterLaunch.indexOf('&') > -1) {
            boosterLaunch = boosterLaunch.substring(0, boosterLaunch.indexOf('&'));
        }

        // If the most recent date data for a booster is in the past, skip it
        if(/^.* \d{4}$/.test(boosterLaunch) && moment(boosterLaunch, 'D MMMM YYYY').diff(now) < 0) {
            continue;
        }

        // Process landing location data
        let landingData = launchData.length === 10 ? launchData[8].text : launchData[5].text;
        let landingStr = landingData;
        if(/no attempt/i.test(landingData)) {
            landingStr = 'Expended - no landing';
        } else if(/not yet known/i.test(landingData)) {
            landingStr = 'Unassigned';
        } else {
            landingStr = landingData.match(/\((.*)\)/i)[1];
            if(landingStr === 'ASDS') {
                landingStr = 'Unspecified drone ship';
            }
        }

        // Process booster class
        let boosterType = boosterData[1].text.replace(/[\n\t]/g, '');
        if(boosterType.indexOf('&') > -1) {
            boosterType = boosterType.substring(0, boosterType.indexOf('&'));
        }

        // Record the cleaned booster data
        let thisBooster = {
            booster: boosterData[0].text.replace(/[\n\t]/g, ''),
            type: boosterType,
            previousFlightCount: parseInt(boosterData[2].text.replace(/[\n\t]/g, '')),
            latestLaunch: boosterLaunch,
            latestLandingSite: landingStr
        };

        boosters.push(thisBooster);
    }
    return boosters;
}

module.exports = {
    getWeather,
    getNOTAMs,
    getClosures,
    getLaunches,
    getF9Boosters
}
