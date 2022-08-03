import axios from 'axios';
import { EmbedAuthorData, EmbedFooterData, MessageEmbed } from 'discord.js';
import { config } from '../config';
import { collections } from '../services/database.service';
import { announce } from '../services/discord.service';
import { logError } from '../services/logger.service';
import { unixTimeToHoursAndMinutes } from '../services/util';
import { WeatherDataType } from '../types/databaseModels';
import {
  ChangeReport,
  ChangeReportTypeEnum,
  ScraperControllerType,
} from '../types/globalTypes';
import { WeatherDataReportType } from '../types/scraperWeatherTypes';
import { ChannelClassEnum } from '../types/serviceDiscordTypes';
import { LogCategoriesEnum } from '../types/serviceLoggerTypes';

const labPadreImageUrl = 'https://img1.wsimg.com/isteam/ip/261df47a-520f-45e6-9d71-45e70b33894c'
  + '/logo/46d3e5b3-d657-4d1f-908d-1a7bf3a6384e.gif';

const collect = async () : Promise<WeatherDataReportType> => {
  try {
    const { data: parsedResult } = await axios.get(config.scrapers.weather.url);
    const forecastOverview = parsedResult.forecastOverview
      ? (parsedResult.forecastOverview as WeatherDataType['forecastOverview']).map((overviewObject) => ({
        date: overviewObject.date,
        morning: {
          weatherCode: overviewObject.morning.weatherCode,
          weatherDesc: overviewObject.morning.weatherDesc,
          weatherIconUrl: overviewObject.morning.weatherIconUrl,
          temp: overviewObject.morning.temp,
          changeofrain: overviewObject.morning.changeofrain,
          rainInInches: overviewObject.morning.rainInInches,
        },
        afternoon: {
          weatherCode: overviewObject.afternoon.weatherCode,
          weatherDesc: overviewObject.afternoon.weatherDesc,
          weatherIconUrl: overviewObject.afternoon.weatherIconUrl,
          temp: overviewObject.afternoon.temp,
          changeofrain: overviewObject.afternoon.changeofrain,
          rainInInches: overviewObject.afternoon.rainInInches,
        },
        evening: {
          weatherCode: overviewObject.evening.weatherCode,
          weatherDesc: overviewObject.evening.weatherDesc,
          weatherIconUrl: overviewObject.evening.weatherIconUrl,
          temp: overviewObject.evening.temp,
          changeofrain: overviewObject.evening.changeofrain,
          rainInInches: overviewObject.evening.rainInInches,
        },
        night: {
          weatherCode: overviewObject.night.weatherCode,
          weatherDesc: overviewObject.night.weatherDesc,
          weatherIconUrl: overviewObject.night.weatherIconUrl,
          temp: overviewObject.night.temp,
          changeofrain: overviewObject.night.changeofrain,
          rainInInches: overviewObject.night.rainInInches,
        },
      }))
      : [];
    return {
      success: true,
      data: {
        aqi: parsedResult.aqi,
        aqiScheme: parsedResult.aqiScheme,
        aqiString: parsedResult.aqiString,
        aqsLastReceived: parsedResult.aqsLastReceived,
        aqsLocation: parsedResult.aqsLocation,
        barometer: parsedResult.barometer,
        barometerTrend: parsedResult.barometerTrend,
        barometerUnits: parsedResult.barometerUnits,
        forecastOverview,
        gust: parsedResult.gust,
        gustAt: parsedResult.gustAt,
        hiTemp: parsedResult.hiTemp,
        hiTempDate: parsedResult.hiTempDate,
        highAtStr: parsedResult.highAtStr,
        humidity: parsedResult.humidity,
        lastReceived: parsedResult.lastReceived,
        loAtStr: parsedResult.loAtStr,
        loTemp: parsedResult.loTemp,
        loTempDate: parsedResult.loTempDate,
        noAccess: parsedResult.noAccess,
        rain: parsedResult.rain,
        rainUnits: parsedResult.rainUnits,
        seasonalRain: parsedResult.seasonalRain,
        systemLocation: parsedResult.systemLocation,
        tempUnits: parsedResult.tempUnits,
        temperature: parsedResult.temperature,
        temperatureFeelLike: parsedResult.temperatureFeelLike,
        timeFormat: parsedResult.timeFormat,
        timeZoneId: parsedResult.timeZoneId,
        wind: parsedResult.wind,
        windDirection: parsedResult.windDirection,
        windUnits: parsedResult.windUnits,
      },
    } as WeatherDataReportType;
  } catch (error) {
    return {
      success: false,
      data: null,
    };
  }
};

const mergeToDatabase = async (report: WeatherDataReportType) : Promise<ChangeReport> => {
  if (!report.success || report.data === null) {
    return {
      success: false,
      changes: [],
    };
  }
  try {
    const result = await collections.weather.findOneAndUpdate(
      {},
      { $set: { ...report.data } },
      { upsert: true },
    );
    return {
      success: result.lastErrorObject !== undefined,
      changes: [{
        changeType: ChangeReportTypeEnum.UPDATED,
        data: report.data,
        originalData: null,
      }],
    };
  } catch (error) {
    logError(LogCategoriesEnum.DB_MERGE_FAILURE, 'scraper_weather', String(error));
    return {
      success: false,
      changes: null,
    };
  }
};

const handleChanges = async (report: ChangeReport) => {
  if (!report.success || !report.changes || report.changes.length === 0) {
    return;
  }
  report.changes.forEach(async (changeItem) => {
    const newData = changeItem.data as WeatherDataType;
    let windDir = 'N';
    if (newData.windDirection < 11.25) {
      windDir = 'N';
    } else if (newData.windDirection < 33.75) {
      windDir = 'NNE';
    } else if (newData.windDirection < 56.25) {
      windDir = 'NE';
    } else if (newData.windDirection < 78.75) {
      windDir = 'ENE';
    } else if (newData.windDirection < 101.25) {
      windDir = 'E';
    } else if (newData.windDirection < 123.75) {
      windDir = 'ESE';
    } else if (newData.windDirection < 146.25) {
      windDir = 'SE';
    } else if (newData.windDirection < 168.75) {
      windDir = 'SSE';
    } else if (newData.windDirection < 191.25) {
      windDir = 'S';
    } else if (newData.windDirection < 213.75) {
      windDir = 'SSW';
    } else if (newData.windDirection < 236.25) {
      windDir = 'SW';
    } else if (newData.windDirection < 258.75) {
      windDir = 'WSW';
    } else if (newData.windDirection < 281.25) {
      windDir = 'W';
    } else if (newData.windDirection < 303.75) {
      windDir = 'WNW';
    } else if (newData.windDirection < 326.25) {
      windDir = 'NW';
    } else if (newData.windDirection < 348.75) {
      windDir = 'NNW';
    }
    const embed = new MessageEmbed()
      .setColor('#0000ff')
      .setTitle('Current near-site weather')
      .setURL('https://www.weatherlink.com/embeddablePage/show/6a07fed5552d4f768299e4b8c611feed/signature')
      .setAuthor({
        name: 'Courtesy of Lab Padre',
        url: labPadreImageUrl,
        iconURL: 'https://labpadre.com/',
      } as EmbedAuthorData)
      .setDescription('Near-site weather is collected by equipment operated by LabPadre.')
      .addFields(
        {
          name: 'Temperature',
          value: `${newData.temperature} °F\nfeels like ${newData.temperatureFeelLike} °F`,
          inline: true,
        },
        {
          name: 'Wind Speed',
          value: `${newData.wind} ${newData.windUnits}\n${windDir} (${newData.windDirection} degrees)`,
          inline: true,
        },
        {
          name: 'High Temperature',
          value: `${newData.hiTemp} °F at ${unixTimeToHoursAndMinutes(newData.hiTempDate)}`,
          inline: true,
        },
        {
          name: 'Low Temperature',
          value: `${newData.loTemp} °F at ${unixTimeToHoursAndMinutes(newData.loTempDate)}`,
          inline: true,
        },
        {
          name: 'Humidity',
          value: `${newData.humidity}%`,
          inline: true,
        },
        {
          name: 'Barometer',
          value: `${newData.barometer} ${newData.barometerUnits}\n${newData.barometerTrend}`,
          inline: true,
        },
        {
          name: 'Rain',
          value: `${newData.rain} ${newData.rainUnits}`,
          inline: true,
        },
        {
          name: 'Rain to date',
          value: `${newData.seasonalRain} ${newData.rainUnits}`,
          inline: true,
        },
      )
      .setTimestamp()
      .setFooter({ text: `Data last received <t:${newData.lastReceived}:F>` } as EmbedFooterData);
    const result = await announce(
      ChannelClassEnum.WEATHER_UPDATE,
      undefined,
      embed,
      [],
    );
    if (result === false) {
      logError(LogCategoriesEnum.ANNOUNCE_FAILURE, 'scraper_weather', 'failed to announce weather update');
    }
  });
};

export default {
  collect,
  mergeToDatabase,
  handleChanges,
} as ScraperControllerType;
