/* eslint-disable no-unused-vars */
/* eslint-disable no-shadow */
import { ObjectId } from 'mongodb';

export type RoadClosureType = {
  day: string,
  startDate: number,
  status: string,
  stopDate: number,
  type: string,
};

export type WeatherForecastType = {
  weatherCode: number,
  weatherDesc: string,
  weatherIconUrl: string,
  temp: number,
  changeofrain: number,
  rainInInches: number,
};

export type WeatherDataType = {
  _id: ObjectId,
  aqi: number | null,
  aqiScheme: number | null,
  aqiString: string | null,
  aqsLastReceived: number | null,
  aqsLocation: string | null,
  barometer: number,
  barometerTrend: string,
  barometerUnits: string,
  forecastOverview: {
    date: string,
    morning: WeatherForecastType,
    afternoon: WeatherForecastType,
    evening: WeatherForecastType,
    night: WeatherForecastType,
  }[],
  gust: number,
  gustAt: number,
  hiTemp: number,
  hiTempDate: number,
  highAtStr: string | null,
  humidity: number,
  lastReceived: number,
  loAtStr: string | null,
  loTemp: number,
  loTempDate: number,
  noAccess: string | null,
  rain: number,
  rainUnits: string,
  seasonalRain: number,
  systemLocation: string,
  tempUnits: string,
  temperature: number,
  temperatureFeelLike: number,
  timeFormat: string,
  timeZoneId: string,
  wind: number,
  windDirection: number,
  windUnits: string,
  a: number,
};

export enum RocketLaunchTimeType {
  UNDECIDED = 'UNDECIDED',
  UNKNOWN = 'UNKNOWN',
  EXACT = 'EXACT',
  EXACT_SECOND = 'EXACT_SECOND',
  WINDOW = 'WINDOW',
  EXACT_SECOND_WINDOW = 'EXACT_SECOND_WINDOW',
  APPROXIMATE = 'APPROXIMATE',
  FLEXIBLE = 'FLEXIBLE',
  ESTIMATED = 'ESTIMATED',
};

export const rocketLaunchTimeTypeDescriptions: Record<RocketLaunchTimeType, string> = {
  [RocketLaunchTimeType.UNDECIDED]: 'A launch time or window has not yet been announced for this launch.',
  [RocketLaunchTimeType.UNKNOWN]: 'The launch time was provided in an unsupported format.',
  [RocketLaunchTimeType.EXACT]: 'This launch is scheduled for an instantaneous one minute launch window.',
  [RocketLaunchTimeType.EXACT_SECOND]: 'This launch is scheduled for an instantaneous one second launch window.',
  [RocketLaunchTimeType.WINDOW]: 'This launch may occur at any point within the provided launch window.',
  [RocketLaunchTimeType.EXACT_SECOND_WINDOW]: 'This launch may occur at any point within the provided launch window.',
  [RocketLaunchTimeType.APPROXIMATE]: 'This launch will occur at approximately the provided time.',
  [RocketLaunchTimeType.FLEXIBLE]: 'This launch may proceed at either of two instantaneous launch windows.',
  [RocketLaunchTimeType.ESTIMATED]: 'There is only a general timeframe associated with this launch.',
};

export enum LaunchAffiliationType {
  ROCKET_LAB = 'ROCKET_LAB',
  SPACEX = 'SPACEX',
  ROSCOSMOS = 'ROSCOSMOS',
  NORTHROP_GRUMMAN = 'NORTHROP_GRUMMAN',
  UNITED_LAUNCH_ALLIANCE = 'UNITED_LAUNCH_ALLIANCE',
  INDIA = 'INDIA',
  ARIANESPACE = 'ARIANESPACE',
  US_AIR_FORCE = 'USAF',
  US_SPACE_FORCE = 'USSF',
  ASTRA = 'ASTRA',
  JAPAN = 'JAXA',
  NASA = 'NASA',
  INTERNATIONAL_SPACE_STATION = 'ISS',
  SPACE_LAUNCH_SYSTEM = 'SLS'
};

export type RocketLaunchType = {
  _id?: ObjectId,
  affiliations: LaunchAffiliationType[],
  date: string,
  description: string,
  launchSite: string,
  mission: string,
  time: {
    type: RocketLaunchTimeType,
    isNET: boolean,
    startDate: number,
    stopDate: number | null,
  },
  vehicle: string,
};

export type NotamType = {
  altitude: number,
  imageUrl: string,
  issuedDate: number,
  notamId: string,
  notamUrl: string,
  startDate: number,
  stopDate: number,
};

export type WatchedNotamType = {
  _id: ObjectId,
  expires: number,
  notamId: string,
};

export enum F9BoosterClassificationType {
  FALCON_9 = 'F9',
  FALCON_HEAVY_SIDE = 'FH_SIDE',
  FALCON_HEAVY_CORE = 'FH_CORE',
  UNKNOWN = 'UNKNOWN',
};

export const f9BoosterClassificationMap: Record<string, F9BoosterClassificationType> = {
  F9: F9BoosterClassificationType.FALCON_9,
  'FH side': F9BoosterClassificationType.FALCON_HEAVY_SIDE,
  'FH core': F9BoosterClassificationType.FALCON_HEAVY_CORE,
};

export const f9ClassificationDescription: Record<F9BoosterClassificationType, string> = {
  [F9BoosterClassificationType.FALCON_9]: 'A standard block five Falcon 9 booster not for use on Falcon Heavy.',
  [F9BoosterClassificationType.FALCON_HEAVY_SIDE]: 'Designated for use as a side booster on Falcon Heavy.',
  [F9BoosterClassificationType.FALCON_HEAVY_CORE]: 'Designated for use as the center core of a Falcon Heavy mission.',
  [F9BoosterClassificationType.UNKNOWN]: 'Unrecognized booster designation.',
};

export const f9LandingLocationInfoMap: Record<string, string> = {
  ASDS: 'A recovery attempt is expected to occur on an autonomous spaceport droneship.',
  ASOG: 'The fourth autonomous spaceport droneship in the fleet '
    + 'and the newest as of 2021. Stationed in Port Canaveral, FL.',
  D: 'A recovery attempt is expected to occur on an autonomous spaceport droneship.',
  JRTI: 'The first and third autonomous spaceport droneship in the fleet. '
    + 'The first is no longer operational. Stationed in Port Canaveral, FL.',
  'LZ-1': 'Opened in 2015, the first of two landing zones supporting RTLS missions at Cape Canaveral, FL.',
  'LZ-2': 'Opened in 2018, the second of two landing zones supporting RTLS at Cape Canaveral, FL',
  'LZ-4': 'Opened in 2018 and supports RTLS missions at Vandenburg SFB.',
  OCISLY: 'The second autonomous spaceport droneship in the fleet. Stationed in the Port of Long Beach, CA.',
  Unknown: 'A recovery attempt is expected, but the details are not currently known.',
};

export type Falcon9Assignment = {
  boosterFlightNumber: number,
  date: string,
  flightDesignation: string,
  turnaroundTime: string,
  recoveryDetails: {
    attempted: boolean,
    location: string | null,
    status: string | null,
  },
  launchDetails: {
    location: string,
    status: string,
  }
};

export type Falcon9BoosterType = {
  _id?: ObjectId,
  boosterSN: string,
  currentClassification: F9BoosterClassificationType,
  assignments: Falcon9Assignment[],
  notes?: string[],
  status: string,
};
