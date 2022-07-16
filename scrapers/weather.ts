import axios from 'axios';
import { config } from '../config';
import { WeatherDataType } from '../types/databaseModels';
import { ScraperControllerType } from '../types/globalTypes';
import { WeatherDataReportType } from '../types/scraperWeatherTypes';

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
        a: parsedResult.a,
      },
    } as WeatherDataReportType;
  } catch (error) {
    return {
      success: false,
      data: null,
    };
  }
};

const mergeToDatabase = async (data: WeatherDataReportType) : Promise<boolean> => {
  console.log(data);
  return true;
};

export default {
  collect,
  mergeToDatabase,
} as ScraperControllerType;
