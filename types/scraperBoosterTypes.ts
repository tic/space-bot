import { Falcon9BoosterType } from './databaseModels';
import { ScrapedDataReportType } from './globalTypes';

export interface BoosterDataReportType extends ScrapedDataReportType {
  data: Falcon9BoosterType[] | null,
};
