import axios from 'axios';
import { config } from '../config';
import { collections } from '../services/database.service';
import { logError } from '../services/logger.service';
import { WeatherDataType } from '../types/databaseModels';
import { ChangeReport, ChangeReportTypeEnum, ScraperControllerType } from '../types/globalTypes';
import { WeatherDataReportType } from '../types/scraperWeatherTypes';
import { LogCategoriesEnum } from '../types/serviceLoggerTypes';

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

export default {
  collect,
  mergeToDatabase,
} as ScraperControllerType;
