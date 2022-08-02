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
