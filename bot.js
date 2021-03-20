const Discord = require('discord.js');
const moment = require('moment');
require('moment-timezone');
var SpaceBot = new Discord.Client();

function time() {
    return new Date().toLocaleTimeString("en-US", {hour12: false, day: "2-digit", month: "2-digit"})
}

console.log(`[${time()}] [DISC] Logging in as ${process.env.DISCUSR}...`)
SpaceBot.login(process.env.DISCSEC);

var min = 0;
function count() {
    min += 3;
    function format(num) { return num < 10 ? `0${num}` : num; }
    SpaceBot.user.setActivity(`stars for ${parseInt(min / 60)}h${format(min % 60)}m`, {type: 'WATCHING'});
}

var UPDATE_CHANNELS = {
    launch: [
        '800875584632258610',
    ],
    notam: [
        '800873290448764979',
    ], // Weather is formatted differently!
    weather: [
        {channel: '801319649601257503', id: '801613956631494676', edit: true},
        // {channel: '801319696266952714', edit: false}
    ],
    closure: [
        '801553695560564756',
    ]
}
var CHANNEL_TOPICS = {
    closure: '__**Road closure info auto-posted by SpaceBot.**__',
    notam: '__**NOTAM info auto-posted by SpaceBot.**__',
    launch: '__**Space Launch into auto-posted by SpaceBot.**__',
}
var ROLES = {
    Launch: '801994532970561576',
    Closure: '801994581423554561',
    TFR: '801994587790639174',
    RocketLab: '801993945336905768',
    SpaceX: '801993942198386760',
    Russia: '801993940415938593',
    NG: '801993937535107122',
    ULA: '801993934808678412',
    India: '801993933311574016',
    Arianespace: '801993931276550155',
    USAF: '801993929154756689',
    USSF: '801993926818398249',
    Astra: '801993924142563369',
    Japan: '801993917553836093',
    ISS: '801993915170947072',
}

SpaceBot.on("ready", () => {
    console.log(`[${time()}] [DISC] ${process.env.DISCUSR} logged in.`);

    function updater(channel_list, type) {
        return async () => {
            if(SpaceBot.__last_updates[type] === SpaceBot.__updates[type]) return; // If nothing has been updated, don't update channel topics
            SpaceBot.__last_updates[type] = SpaceBot.__updates[type];
            for(let i = 0; i < channel_list.length; i++) {
                await SpaceBot.channels.cache.get(UPDATE_CHANNELS.closure[i]).setTopic(`${CHANNEL_TOPICS['closure']} | Updated around ${SpaceBot.__updates[type]} EST`);
                await new Promise((resolve, _) => setTimeout(resolve, 1000));
            }
        }
    }

    SpaceBot.__intervals = {
        'notams': setInterval(updater(UPDATE_CHANNELS.notam, 'notams'), 590000),
        'closures': setInterval(updater(UPDATE_CHANNELS.notam, 'closures'), 600000),
        'launch_schedule': setInterval(updater(UPDATE_CHANNELS.notam, 'launch_schedule'), 610000),
    }
    SpaceBot.__last_updates = {
        'notams': null,
        'closures': null,
        'launch_schedule': null,
    }
    SpaceBot.__updates = {
        'notams': null,
        'closures': null,
        'launch_schedule': null,
    }

    setInterval(count, 180000);
});
SpaceBot.on("error", err => {
    console.log(`[${time()}] [DISC] !! Error in discord bot:`);
    console.warn(err);
});

SpaceBot.sendMessage = (channel, content) => SpaceBot.channels.cache.get(channel) ? SpaceBot.channels.cache.get(channel).send(content) : null;
SpaceBot.receiveUpdate = async ({type, old: old_data, new: new_data}) => {
    var chans = UPDATE_CHANNELS[type];
    if(type === 'notam') {
        if(old_data === 'repost') {
            var msg = `__**REPOSTED**__: <@&${ROLES['TFR']}> has been reposted:\n> NOTAM: ${new_data.id}\n> Start: \`${moment(new_data.start).format('M-DD, HH:mm')} EST\`\n> End: \`${moment(new_data.stop).format('M-DD, HH:mm')} EST\`\n> Altitude: \`${new_data.altitude}${new_data.altitude === 'Unlimited' ? '' : ' feet MSL'}\`\n${new_data.link}`;
        } else if(JSON.stringify(old_data) === '{}') {
            var msg = `__**NEW**__: <@&${ROLES['TFR']}> posted:\n> NOTAM: ${new_data.id}\n> Start: \`${moment(new_data.start).format('M-DD, HH:mm')} EST\`\n> End: \`${moment(new_data.stop).format('M-DD, HH:mm')} EST\`\n> Altitude: \`${new_data.altitude}${new_data.altitude === 'Unlimited' ? '' : ' feet MSL'}\`\n${new_data.link}`;
        } else if(JSON.stringify(new_data) === '{}') {
            var msg = `__**RECALLED**__: <@&${ROLES['TFR']}> has been removed:\n> NOTAM: ${old_data.id}\n> Start: ~~\`${moment(old_data.start).format('M-DD, HH:mm')} EST\`~~\n> End: ~~\`${moment(old_data.stop).format('M-DD, HH:mm')} EST\`~~\n> Altitude: ~~\`${old_data.altitude}${old_data.altitude === 'Unlimited' ? '' : ' feet MSL'}\`~~`;
        } else {
            var msg = [
                `**UPDATE**: <@&${ROLES['TFR']}> has been modified:`,
                `> NOTAM: ${new_data.id}`,
                old_data.start === new_data.start ? `> Start: ${moment(new_data.start).format('M-DD, HH:mm')}` : `> Start: \`~~${moment(old_data.start).format('M-DD, HH:mm')}~~ ${moment(new_data.start).format('M-DD, HH:mm')} EST\``,
                old_data.stop === new_data.stop ? `> End: ${moment(new_data.stop).format('M-DD, HH:mm')} EST` : `> End: \`~~${moment(old_data.stop).format('M-DD, HH:mm')}~~ \`${moment(new_data.stop).format('M-DD, HH:mm')} EST\``,
                old_data.altitude === new_data.altitude ? `> Altitude: ${new_data.altitude}` : `> Altitude: \`~~${old_data.altitude}~~ ${new_data.altitude}\``,
                new_data.link,
            ].join('\n');
        }
        for(let i = 0; i < chans.length; i++) {
            await SpaceBot.sendMessage(chans[i], msg);
            await new Promise((resolve, _) => setTimeout(resolve, 1000));
        }
    } else if(type === 'closure') {
        if(JSON.stringify(old_data) === '{}') {
            var msg = `__**NEW**__: <@&${ROLES['Closure']}> posted:\n> Day: ${moment(new_data.day, 'YYYY-MM-DD').format('ddd M-DD')}\n> Start: \`${moment(new_data.start).format('HH:mm')}\`\n> End: \`${moment(new_data.stop).format('HH:mm')}\`\n> Type: ${new_data.type}\n> Status: ${new_data.status}`;
        } else {
            var msg = [
                `**UPDATE**: <@&${ROLES['Closure']}> has been modified:`,
                `> Day: ${moment(new_data.day, 'YYYY-MM-DD').format('ddd M-DD')}`,
                old_data.start === new_data.start ? `> Start: \`${moment(new_data.start).format('HH:mm')}\`` : `> Start: ~~\`${moment(old_data.start).format('HH:mm')}\`~~\` ${moment(new_data.start).format('HH:mm')}\``,
                old_data.stop === new_data.stop ? `> End: \`${moment(new_data.stop).format('HH:mm')}\`` : `> End: ~~\`${moment(old_data.stop).format('HH:mm')}\`~~\` ${moment(new_data.stop).format('HH:mm')}\``,
                old_data.type === new_data.type ? `> Type: ${new_data.type}` : `> Type: ~~${old_data.type}~~ ${new_data.type}`,
                old_data.status === new_data.status ? `> Status: ${new_data.status}` : `> Status: ~~${old_data.status}~~ ${new_data.status}`
            ].join('\n');
        }
        for(let i = 0; i < chans.length; i++) {
            await SpaceBot.sendMessage(chans[i], msg);
            await new Promise((resolve, _) => setTimeout(resolve, 1000));
        }
    } else if(type === 'weather') {
        let windDir = new_data.windDirection;
        windDir = windDir < 11.25 ? 'N': windDir < 33.75 ? 'NNE': windDir < 56.25 ? 'NE': windDir < 78.75 ? 'ENE': windDir < 101.25 ? 'E': windDir < 123.75 ? 'ESE': windDir < 146.25 ? 'SE': windDir < 168.75 ? 'SSE': windDir < 191.25 ? 'S': windDir < 213.75 ? 'SSW': windDir < 236.25 ? 'SW': windDir < 258.75 ? 'WSW': windDir < 281.25 ? 'W': windDir < 303.75 ? 'WNW': windDir < 326.25 ? 'NW': windDir < 348.75 ? 'NNW': 'N';
        let msg = [
            `__**On-site weather**__`,
            `*Last updated:* ${moment(new_data.lastReceived, 'x').format('MM-DD-YY - HH:mm')} EST:`,
            `> Temp: ${new_data.temperature}F *feels like ${new_data.temperatureFeelLike}F*`,
            `> Wind: ${new_data.wind} ${new_data.windUnits} ${windDir} *${new_data.windDirection} deg*`,
            `> High: ${new_data.hiTemp}F *at ${moment(new_data.hiTempDate, 'x').format('HH:mm')}*`,
            `> Low: ${new_data.loTemp}F *at ${moment(new_data.loTempDate, 'x').format('HH:mm')}*`,
            `> Humidity: ${new_data.humidity}%`,
            `> Barometer: ${new_data.barometer} ${new_data.barometerUnits}; *${new_data.barometerTrend}*`,
            `> Rain: ${new_data.rain} ${new_data.rainUnits}`,
            `> Rain to date: ${new_data.seasonalRain} ${new_data.rainUnits}`,
        ].join('\n');
        for(let i = 0; i < chans.length; i++) {
            if(chans[i].edit) (await SpaceBot.channels.cache.get(chans[i].channel).messages.fetch(chans[i].id)).edit(msg);
            else await SpaceBot.sendMessage(chans[i].channel, msg);
            await new Promise((resolve, _) => setTimeout(resolve, 1000));
        }
    } else if(type === 'launch') {

        function getDisplayTime(time) {
            if(time.type === 'undecided') return [time.start, 'TBD'];
            start_adj = moment(time.start).local();
            if(time.type === 'exact') return [start_adj.format('ddd MMM Do'), start_adj.format('HH:mm') + ' (eastern)'];
            if(time.type === 'approximate') return [start_adj.format('ddd MMM Do'), start_adj.format('HH:mm') + ' (eastern, estimated)'];
            if(time.type === 'window') return [start_adj.format('ddd MMM Do'), `Launch window ${start_adj.format('HH:mm')}-${moment(time.stop).local().format('HH:mm (MMM Do)')} (eastern)`];
            return [time.start, 'TBD'];
        }

        if(JSON.stringify(old_data) === '{}') {
            [new_disp_date, new_disp_time] = getDisplayTime(moment(new_data.time));
            var msg = [
                `__**NEW**__: <@&${ROLES['Launch']}> posted:`,
                `> ${new_data.affiliations.map(a => `<@&${ROLES[a]}>`).join(' ')}`,
                `> Mission: ${new_data.mission}`,
                `> Vehicle: ${new_data.vehicle}`,
                `> Target date: ${new_data.date}`,
                `> Launch window: ${new_data.window}`,
                `> Launch site: ${new_data.launch_site}`,
                `> Mission description:`,
                new_data.description
            ].join('\n');
        } else {
            [old_disp_date, old_disp_time] = old_data.time ? getDisplayTime(moment(old_data.time)) : [old_data.date, old_data.window];
            [new_disp_date, new_disp_time] = getDisplayTime(new_data.time);
            var msg = [
                `**UPDATE**: <@&${ROLES['Launch']}> has been modified:`,
                `> ${new_data.affiliations.map(a => `<@&${ROLES[a]}>`).join(' ')}`,
                `> Mission: ${new_data.mission}`,
                `> Vehicle: ${new_data.vehicle}`,
                old_disp_date === new_disp_date ? `> Target date: ${new_disp_date}` : `> **Target date: ~~${old_disp_date}~~ ${new_disp_date}**`,
                old_disp_time === new_disp_time ? `> Launch window: ${new_disp_time}` : `> **Launch window: ~~${old_disp_time}~~ ${new_disp_time}**`,
                old_data.site === new_data.site ? `> Launch site: ${new_data.launch_site}` : `> **Launch site: ~~${old_data.launch_site}~~ **${new_data.launch_site}**`,
                `> Mission description`,
                new_data.description
            ].join('\n');
        }
        for(let i = 0; i < chans.length; i++) {
            await SpaceBot.sendMessage(chans[i], msg);
            await new Promise((resolve, _) => setTimeout(resolve, 2000));
        }
    }
}

module.exports = {
    SpaceBot,
    UPDATE_CHANNELS,
    CHANNEL_TOPICS,
}
