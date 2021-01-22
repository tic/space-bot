const fetch = require('node-fetch');
const JSSoup = require('jssoup').default;
const moment = require('moment');
require('moment-timezone');
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
];

async function getWeather() {
    return await (await fetch(WEATHER)).json();
}
function getNOTAMURL(id) {
    return `${NOTAMBASE}/save_pages/detail_${id.replace('/', '_')}.html`;
}
async function getNOTAMs() {
    const content = await (await fetch(NOTAMS, {method: 'POST'})).text();
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
            if(type !== "SPACE OPERATIONS") return null;

            notam_id = (new JSSoup(notam_id)).find('u').contents.toString()
            let link = getNOTAMURL(notam_id);

            const tfr_data = await (await fetch(link)).text();
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

            let [ altitude ] = detail_table.findAll('tr')
                .map(tr => {
                    let text = tr.find('font').contents.toString();
                    if(text.indexOf('Altitude') > -1) {
                        let re = text.match(/(\d+) feet MSL/);
                        if(re) return re[1];
                        return 'Unlimited';
                    }
                    return null;
                })
                .filter(_ => _);

            let image = tfr_soup.findAll('table')
                .map(table => {
                    let img = table.find('img');
                    if(img) return img.attrs.src;
                    return null;
                }).filter(img => img && img.indexOf('save_maps') > -1);

            return {
                id: notam_id,
                altitude: altitude ? altitude : 'N/A',
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
async function getClosures() {
    const content = await (await fetch(CLOSURES)).text();
    const soup = new JSSoup(content);
    // body of the first table
    let closure_table = soup.find('table').find('tbody');
    let closures = closure_table.findAll('tr')
    .map(row => {
        let [type, date, time, status] = row.findAll('td')
            .map(cell => cell.contents);
        let [start, stop] = time.toString().split(' to ')
            .map(time => {
                time = time.replace(' ', '');
                const ttype = time.substring(time.length - 2, time.length);
                if(ttype === "am") {
                    // AM time
                    var [hr, min] = time.split(':').map(t => parseInt(t));
                } else {
                    // PM time
                    var [hr, min] = time.split(':').map(t => parseInt(t));
                    if(hr !== 12) hr += 12;
                }
                return {hr, min};
            });


        let datestr = date.toString().replace('.', '');
        datestr = datestr.substring(datestr.indexOf(', ') + 1, datestr.length);
        const m = moment(datestr, 'MMM DD, YYYY').hour(23).tz('America/Chicago');
        const m_start = moment(m).hour(start.hr).minute(start.min);
        const m_stop = moment(m).hour(stop.hr).minute(stop.min);
        return {
            start: m_start,
            status: status.toString(),
            stop: m_stop,
            type: type.toString(),
        };
    });

    return closures;
}
function getAffiliations(description) {
    return [...new Set(AFFILIATIONS
        .filter(({tag}) => description.indexOf(tag) > -1)
        .map(({group}) => group))];
}
async function getLaunches() {
    const content = await (await fetch(LAUNCHES)).text();
    const soup = new JSSoup(content);
    let launch_container = soup.find('article')
        .nextElement
        .findNextSibling();

    let mission_pieces = launch_container.findAll('div');
    let launches = [];
    for(let i = 0; i < mission_pieces.length - 2; i += 3) {
        // Date + vehicle + mission are in the first block
        let [ date, vmiss ] = mission_pieces[i].findAll('span')
            .map(_ => he.decode(_.contents.toString()));
        let [ vehicle, mission ] = vmiss.split(' • ');

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

        launches.push({
            mission,
            affiliations,
            date,
            description,
            launch_site,
            vehicle,
            window: launch_win,
        });
    }
    return launches;
}

module.exports = {
    getWeather,
    getNOTAMs,
    getClosures,
    getLaunches,
}
