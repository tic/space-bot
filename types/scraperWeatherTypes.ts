import { WeatherDataType } from './databaseModels';
import { ScrapedDataReportType } from './globalTypes';

export interface WeatherDataReportType extends ScrapedDataReportType {
  data: WeatherDataType[] | null,
};
