/* eslint-disable no-unused-vars */
/* eslint-disable no-shadow */
import { F9BoosterClassificationType, Falcon9BoosterType } from './databaseModels';
import { ScrapedDataReportType } from './globalTypes';

export interface BoosterDataReportType extends ScrapedDataReportType {
  data: Falcon9BoosterType[] | null,
};

export const BoosterTypeToString: Record<F9BoosterClassificationType, string> = {
  [F9BoosterClassificationType.FALCON_9]: 'Standard booster',
  [F9BoosterClassificationType.FALCON_HEAVY_CORE]: 'Falcon Heavy core booster',
  [F9BoosterClassificationType.FALCON_HEAVY_SIDE]: 'Falcon Heavy side booster',
  [F9BoosterClassificationType.UNKNOWN]: 'Unknown booster designation',
};

export enum LandingLocationEnum {
  SHORTFALL_OF_GRAVITAS = 'A Shortfall of Gravitas',
  OF_COURSE_I_STILL_LOVE_YOU = 'Of Course I Still Love You',
  JUST_READ_THE_INSTRUCTIONS = 'Just Read the Instructions',
  LZ_1 = 'Landing Zone 1',
  LZ_2 = 'Landing Zone 2',
  LZ_4 = 'Landing Zone 4',
  UNKNOWN_DRONESHIP = 'TBD Autonomous Droneship',
  UNKNOWN = 'Unknown landing location',
};

export const StringToLandingLocation: Record<string, LandingLocationEnum> = {
  ASOG: LandingLocationEnum.SHORTFALL_OF_GRAVITAS,
  OCISLY: LandingLocationEnum.OF_COURSE_I_STILL_LOVE_YOU,
  JRTI: LandingLocationEnum.JUST_READ_THE_INSTRUCTIONS,
  'LZ-1': LandingLocationEnum.LZ_1,
  'LZ-2': LandingLocationEnum.LZ_2,
  'LZ-4': LandingLocationEnum.LZ_4,
  D: LandingLocationEnum.UNKNOWN_DRONESHIP,
  UNKNOWN: LandingLocationEnum.UNKNOWN,
};
