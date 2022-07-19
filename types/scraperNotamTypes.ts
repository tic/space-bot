import { NotamType } from './databaseModels';
import { ScrapedDataReportType } from './globalTypes';

export type NotamTemplateType = {
  altitude: number | null,
  imageUrl: string | null,
  issuedDate: number | null,
  notamId: string | null,
  notamUrl: string | null,
  startDate: number | null,
  stopDate: number | null,
};

export interface NotamDataReportType extends ScrapedDataReportType {
  data: NotamType[] | null,
};
