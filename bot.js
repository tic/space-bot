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
    ],
    'launch-reminder': [
        '910711567950172220',
    ],
    error: [
        '914676717510090752',
    ]
}
var CHANNEL_TOPICS = {
    closure: '__**Road closure info auto-posted by SpaceBot.**__',
    notam: '__**NOTAM info auto-posted by SpaceBot.**__',
    launch: '__**Space Launch into auto-posted by SpaceBot.**__',
}
var ROLES = {
    Developer: '801662139546075138',
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
                await SpaceBot.channels.cache.get(UPDATE_CHANNELS.closure[i]).setTopic(`${CHANNEL_TOPICS[type]} | Updated around ${SpaceBot.__updates[type]} EST`);
                await new Promise((resolve, _) => setTimeout(resolve, 1000));
            }
        }
    }

    SpaceBot.__intervals = {
        'notam': setInterval(updater(UPDATE_CHANNELS.notam, 'notam'), 590000),
        'closure': setInterval(updater(UPDATE_CHANNELS.notam, 'closure'), 600000),
        'launch': setInterval(updater(UPDATE_CHANNELS.notam, 'launch'), 610000),
    }
    SpaceBot.__last_updates = {
        'notam': null,
        'closure': null,
        'launch': null,
    }
    SpaceBot.__updates = {
        'notam': null,
        'closure': null,
        'launch': null,
    }

    setInterval(count, 180000);
});
SpaceBot.on("error", err => {
    console.log(`[${time()}] [DISC] !! Error in discord bot:`);
    console.warn(err);
});

SpaceBot.sendMessage = async (channel, content) => (await SpaceBot.channels.fetch(channel)) ? (await SpaceBot.channels.fetch(channel)).send(content) : null;
SpaceBot.receiveUpdate = async ({type, old: old_data, new: new_data}) => {
    var chans = UPDATE_CHANNELS[type];

    function getDisplayTime(time) {
        try {
            if(time.type === 'undecided') return [time.start || 'TBD', 'TBD'];
            start_adj = moment(time.start).local();
            if(time.type === 'exact') return [start_adj.format('ddd MMM Do'), start_adj.format('HH:mm') + ' (eastern)'];
            if(time.type === 'exact-second') return [start_adj.format('ddd MMM Do'), start_adj.format('HH:mm:ss') + ' (eastern)'];
            if(time.type === 'approximate') return [start_adj.format('ddd MMM Do'), start_adj.format('HH:mm') + ' (eastern, estimated)'];
            if(time.type === 'window') return [start_adj.format('ddd MMM Do'), `Launch window ${start_adj.format('HH:mm')}-${moment(time.stop).local().format('HH:mm (MMM Do)')} (eastern)`];
            if(time.type === 'exact-second-window') return [start_adj.format('ddd MMM Do'), `Launch window ${start_adj.format('HH:mm:ss')}-${moment(time.stop).local().format('HH:mm:ss (MMM Do)')} (eastern)`];
            if(time.type === 'flexible') return [start_adj.format('ddd MMM Do'), `Either ${start_adj.format('HH:mm:ss')} or ${moment(time.stop).local().format('HH:mm:ss')}`];
        } catch(err) {
            console.log(`Caught error in getDisplayTime() (bot.js line 106)\n${err}`);
            return ['Error', 'Error']
        }
        return [time.start || 'TBD', 'TBD'];
    }

    if(type === 'notam') {
        if(old_data === 'repost') {
            format_day = `${moment(new_data.start).format('dddd')} the ${moment(new_data.start).format('Do')}`;
            var msg = new Discord.MessageEmbed()
                .setColor('#0000ff')
                .setTitle(`NOTAM Reposted for ${format_day}`)
                .setURL(new_data.link)
                .setAuthor('Federal Aviation Administration (FAA)', 'https://tfr.faa.gov/tfr2/images/head_app_logo.gif', 'https://www.faa.gov/')
                .setDescription(`A previous Temporary Flight Restriction (TFR) was reposted.`)
                .addFields(
                    { name: 'NOTAM ID', value: new_data.id, inline: true},
                    { name: 'Restriction Begins', value: `${moment(new_data.start).format('M-DD, HH:mm')} Eastern`, inline: true},
                    { name: 'Restriction Ends', value: `${moment(new_data.stop).format('M-DD, HH:mm')} Eastern`, inline: true},
                    { name: 'Altitude', value: `${new_data.altitude}${new_data.altitude === 'Unlimited' ? '' : ' feet MSL'}`, inline: true}
                )
                .setThumbnail(new_data.image)
                .setTimestamp()
        } else if(JSON.stringify(old_data) === '{}') {
            format_day = `${moment(new_data.start).format('dddd')} the ${moment(new_data.start).format('Do')}`;
            var msg = new Discord.MessageEmbed()
                .setColor('#00ff00')
                .setTitle(`NOTAM Posted for ${format_day}`)
                .setURL(new_data.link)
                .setAuthor('Federal Aviation Administration (FAA)', 'https://i.gyazo.com/ab618db4d6b3a93650aa4c786bb56567.png', 'https://www.faa.gov/')
                .setDescription(`A new Temporary Flight Restriction (TFR) has been posted. Details of the TFR are shown below.`)
                .addFields(
                    { name: 'NOTAM ID', value: new_data.id, inline: true},
                    { name: 'Restriction Begins', value: `${moment(new_data.start).format('M-DD, HH:mm')} Eastern`, inline: true},
                    { name: 'Restriction Ends', value: `${moment(new_data.stop).format('M-DD, HH:mm')} Eastern`, inline: true},
                    { name: 'Altitude', value: `${new_data.altitude}${new_data.altitude === 'Unlimited' ? '' : ' feet MSL'}`, inline: true}
                )
                .setThumbnail(new_data.image)
                .setTimestamp()
        } else if(JSON.stringify(new_data) === '{}') {
            format_day = `${moment(old_data.start).format('dddd')} the ${moment(old_data.start).format('Do')}`;
            var msg = new Discord.MessageEmbed()
                .setColor('#ff0000')
                .setTitle(`NOTAM for Removed for ${format_day}`)
                .setURL(old_data.link)
                .setAuthor('Federal Aviation Administration (FAA)', 'https://i.gyazo.com/ab618db4d6b3a93650aa4c786bb56567.png', 'https://www.faa.gov/')
                .setDescription(`An existing Temporary Flight Restriction (TFR) was removed. The previous details for the TFR are shown below.`)
                .addFields(
                    { name: 'NOTAM ID', value: `${old_data.id}`, inline: true},
                    { name: 'Restriction Begins', value: `${moment(old_data.start).format('M-DD, HH:mm')} Eastern`, inline: true},
                    { name: 'Restriction Ends', value: `${moment(old_data.stop).format('M-DD, HH:mm')} Eastern`, inline: true},
                    { name: 'Altitude', value: `${old_data.altitude}${old_data.altitude === 'Unlimited' ? '' : ' feet MSL'}`, inline: true}
                )
                .setThumbnail(new_data.image)
                .setTimestamp()
        } else {
            format_day = `${moment(new_data.start).format('dddd')} the ${moment(new_data.start).format('Do')}`;
            var msg = new Discord.MessageEmbed()
                .setColor('#ffff00')
                .setTitle(`NOTAM Modified for ${format_day}`)
                .setURL(new_data.link)
                .setAuthor('Federal Aviation Administration (FAA)', 'https://i.gyazo.com/ab618db4d6b3a93650aa4c786bb56567.png', 'https://www.faa.gov/')
                .setDescription(`An existing Temporary Flight Restriction (TFR) has been modified.`)
                .addFields(
                    { name: 'NOTAM ID', value: new_data.id, inline: true},
                    { name: 'Restriction Begins', value: old_data.start === new_data.start ? `${moment(new_data.start).format('M-DD, HH:mm')} Eastern` : `~~${moment(old_data.start).format('M-DD, HH:mm')}~~\n${moment(new_data.start).format('M-DD, HH:mm')} Eastern`, inline: true},
                    { name: 'Restriction Ends', value: old_data.stop === new_data.stop ? `${moment(new_data.stop).format('M-DD, HH:mm')} Eastern` : `~~${moment(old_data.stop).format('M-DD, HH:mm')}~~ \`${moment(new_data.stop).format('M-DD, HH:mm')} Eastern`, inline: true},
                    { name: 'Altitude', value: old_data.altitude === new_data.altitude ? new_data.altitude : `~~${old_data.altitude}~~\n${new_data.altitude}${new_data.altitude === 'Unlimited' ? '' : ' feet MSL'}`, inline: true}
                )
                .setThumbnail(new_data.image)
                .setTimestamp()
        }
        for(let i = 0; i < chans.length; i++) {
            await SpaceBot.sendMessage(chans[i], {content: `<@&${ROLES['TFR']}>`, embed: msg});
            await new Promise((resolve, _) => setTimeout(resolve, 1000));
        }
    } else if(type === 'closure') {
        if(JSON.stringify(old_data) === '{}') {
            var msg = new Discord.MessageEmbed()
                .setColor('#00ff00')
                .setTitle(`Road Closure Posted`)
                .setURL('https://cameroncounty.us/spacex/')
                .setAuthor('Highway 4 - Cameron County', 'https://www.cameroncounty.us/wp-content/uploads/2020/02/CCSEAL_TRANSPARENT.png', 'https://cameroncounty.us/spacex/')
                .setDescription(`A new closure of Highway 4 in Boca Chica has been posted.`)
                .addFields(
                    { name: 'Day', value: moment(new_data.day, 'YYYY-MM-DD').format('dddd, M-DD'), inline: true},
                    { name: 'Type', value: new_data.type, inline: true},
                    { name: 'Closure Begins', value: `${moment(new_data.start).format('HH:mm')} Eastern`, inline: true},
                    { name: 'Closure Ends', value: `${moment(new_data.stop).format('HH:mm')} Eastern`, inline: true},
                    { name: 'Status', value: new_data.status, inline: true}
                )
                .setTimestamp()
        } else {
            var msg = new Discord.MessageEmbed()
                .setColor('#ffff00')
                .setTitle(`Road Closure Modification`)
                .setURL('https://cameroncounty.us/spacex/')
                .setAuthor('Highway 4 - Cameron County', 'https://www.cameroncounty.us/wp-content/uploads/2020/02/CCSEAL_TRANSPARENT.png', 'https://cameroncounty.us/spacex/')
                .setDescription(`Details surrounding a closure of Highway 4 in Boca Chica have changed.`)
                .addFields(
                    { name: 'Day', value: moment(new_data.day, 'YYYY-MM-DD').format('dddd, M-DD'), inline: true},
                    { name: 'Type', value: old_data.type === new_data.type ? new_data.type : `~~${old_data.type}~~\n${new_data.type}`, inline: true},
                    { name: 'Closure Begins', value: old_data.start === new_data.start ? `${moment(new_data.start).format('HH:mm')} Eastern` : `~~${moment(old_data.start).format('HH:mm')}~~\n${moment(new_data.start).format('HH:mm')} Eastern`, inline: true},
                    { name: 'Closure Ends', value: old_data.stop === new_data.stop ? `${moment(new_data.stop).format('HH:mm')} Eastern` : `~~${moment(old_data.stop).format('HH:mm')}~~\n${moment(new_data.stop).format('HH:mm')} Eastern`, inline: true},
                    { name: 'Status', value: old_data.status === new_data.status ? new_data.status : `~~${old_data.status}~~\n${new_data.status}`, inline: true}
                )
                .setTimestamp()
        }
        for(let i = 0; i < chans.length; i++) {
            await SpaceBot.sendMessage(chans[i], {content: `<@&${ROLES['Closure']}>`, embed: msg});
            await new Promise((resolve, _) => setTimeout(resolve, 1000));
        }
    } else if(type === 'weather') {
        let windDir = new_data.windDirection;
        windDir = windDir < 11.25 ? 'N': windDir < 33.75 ? 'NNE': windDir < 56.25 ? 'NE': windDir < 78.75 ? 'ENE': windDir < 101.25 ? 'E': windDir < 123.75 ? 'ESE': windDir < 146.25 ? 'SE': windDir < 168.75 ? 'SSE': windDir < 191.25 ? 'S': windDir < 213.75 ? 'SSW': windDir < 236.25 ? 'SW': windDir < 258.75 ? 'WSW': windDir < 281.25 ? 'W': windDir < 303.75 ? 'WNW': windDir < 326.25 ? 'NW': windDir < 348.75 ? 'NNW': 'N';
        var msg = new Discord.MessageEmbed()
            .setColor('#0000ff')
            .setTitle(`Current near-site weather`)
            .setURL('https://www.weatherlink.com/embeddablePage/show/6a07fed5552d4f768299e4b8c611feed/signature')
            .setAuthor('Courtesy of LabPadre', 'https://img1.wsimg.com/isteam/ip/261df47a-520f-45e6-9d71-45e70b33894c/logo/46d3e5b3-d657-4d1f-908d-1a7bf3a6384e.gif', 'https://labpadre.com/')
            .setDescription('Near-site weather is collected by equipment operated by LabPadre.')
            .addFields(
                { name: 'Temperature', value: `${new_data.temperature} °F\nfeels like ${new_data.temperatureFeelLike} °F`, inline: true},
                { name: 'Wind Speed', value: `${new_data.wind} ${new_data.windUnits}\n${windDir} (${new_data.windDirection} degrees)`, inline: true},
                { name: 'High Temperature', value: `${new_data.hiTemp} °F at ${moment(new_data.hiTempDate, 'x').format('HH:mm')}`, inline: true},
                { name: 'Low Temperature', value: `${new_data.loTemp} °F at ${moment(new_data.loTempDate, 'x').format('HH:mm')}`, inline: true},
                { name: 'Humidity', value: `${new_data.humidity}%`, inline: true},
                { name: 'Barometer', value: `${new_data.barometer} ${new_data.barometerUnits}\n${new_data.barometerTrend}`, inline: true},
                { name: 'Rain', value: `${new_data.rain} ${new_data.rainUnits}`, inline: true},
                { name: 'Rain to date', value: `${new_data.seasonalRain} ${new_data.rainUnits}`, inline: true}
            )
            .setTimestamp()
            .setFooter(`Data last received ${moment(new_data.lastReceived, 'x').format('MM-DD-YY - HH:mm')} Eastern`)
        for(let i = 0; i < chans.length; i++) {
            if(chans[i].edit) (await SpaceBot.channels.cache.get(chans[i].channel).messages.fetch(chans[i].id)).edit(msg);
            else await SpaceBot.sendMessage(chans[i].channel, msg);
            await new Promise((resolve, _) => setTimeout(resolve, 1000));
        }
    } else if(type === 'launch') {
        var affils = `${new_data.affiliations.map(a => `<@&${ROLES[a]}>`).join(' ')}`;
        if(JSON.stringify(old_data) === '{}') {
            [new_disp_date, new_disp_time] = getDisplayTime(new_data.time);
            var msg = new Discord.MessageEmbed()
                .setColor('#ff0000')
                .setTitle(`${new_data.vehicle} ● ${new_data.mission}`)
                .setURL('https://spaceflightnow.com/launch-schedule/')
                .setAuthor('New Launch Posted! | SpaceflightNow', 'https://i.gyazo.com/bbfc6b20b64ac0db894f112e14a58cd5.jpg', 'https://spaceflightnow.com/')
                .setDescription(new_data.description)
                .addFields(
                    { name: 'Launch Date', value: new_disp_date, inline: true},
                    { name: 'Launch Time', value: new_disp_time, inline: true},
                    { name: 'Launch Site', value: new_data.launch_site, inline: false}
                )
                .setTimestamp()
        } else {
            [old_disp_date, old_disp_time] = old_data.time ? getDisplayTime(old_data.time) : [old_data.date, old_data.window];
            [new_disp_date, new_disp_time] = getDisplayTime(new_data.time);
            if(old_disp_date === new_disp_date && old_disp_time === new_disp_time) return;
            var msg = new Discord.MessageEmbed()
                .setColor('#ffff00')
                .setTitle(`${new_data.vehicle} ● ${new_data.mission}`)
                .setURL('https://spaceflightnow.com/launch-schedule/')
                .setAuthor('Launch Update! | SpaceflightNow', 'https://i.gyazo.com/bbfc6b20b64ac0db894f112e14a58cd5.jpg', 'https://spaceflightnow.com/')
                .setDescription(new_data.description)
                .addFields(
                    { name: 'Launch Date', value: old_disp_date === new_disp_date ? new_disp_date : `~~${old_disp_date}~~\n${new_disp_date}`, inline: true},
                    { name: 'Launch Time', value: old_disp_time === new_disp_time ? new_disp_time : `~~${old_disp_time}~~\n${new_disp_time}`, inline: true},
                    { name: 'Launch Site', value: old_data.site === new_data.site ? new_data.launch_site : `~~${old_data.launch_site}~~\n${new_data.launch_site}`, inline: false}
                )
                .setTimestamp()
        }
        for(let i = 0; i < chans.length; i++) {
            await SpaceBot.sendMessage(chans[i], {content: `<@&${ROLES['Launch']}>\n${affils}`, embed: msg});
            await new Promise((resolve, _) => setTimeout(resolve, 2000));
        }
    } else if(type === 'launch-reminder') {
        const imminent = old_data === true;
        var affils = `${new_data.affiliations.map(a => `<@&${ROLES[a]}>`).join(' ')}`;
        const [lDate, lTime] = getDisplayTime(new_data.time);
        var msg = new Discord.MessageEmbed()
            .setColor('#f70062')
            .setTitle(`${new_data.vehicle} ● ${new_data.mission}`)
            .setURL('https://spaceflightnow.com/launch-schedule/')
            .setAuthor((imminent ? 'L-03h Reminder' : 'L-24h Reminder') + ' Launch! | SpaceflightNow', 'https://i.gyazo.com/bbfc6b20b64ac0db894f112e14a58cd5.jpg', 'https://spaceflightnow.com/')
            .setDescription(new_data.description)
            .addFields(
                { name: 'Launch Date', value: lDate, inline: true},
                { name: 'Launch Time', value: lTime, inline: true},
                { name: 'Launch Site', value: new_data.launch_site, inline: false}
            )
            .setTimestamp()
        for(let i = 0; i < chans.length; i++) {
            await SpaceBot.sendMessage(chans[i], {content: `${imminent ? '**Imminent Launch Reminder**' : 'Upcoming Launch Reminder'}\n<@&${ROLES['Launch']}>\n${affils}`, embed: msg});
            await new Promise((resolve, _) => setTimeout(resolve, 2000));
        }
    } else if(type === 'error') {
        var msg = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setTitle(`Error Report`)
            .setDescription(new_data.substring(0, 1800))
            .addFields(
                { name: 'Report Time', value: moment().format('HH:mm:ss'), inline: true},
            )
            .setTimestamp()
        for(let i = 0; i < chans.length; i++) {
            await SpaceBot.sendMessage(chans[i], {content: `<@&${ROLES['Developer']}>`, embed: msg});
            await new Promise((resolve, _) => setTimeout(resolve, 2000));
        }
    }
}

module.exports = {
    SpaceBot,
    UPDATE_CHANNELS,
    CHANNEL_TOPICS,
}
