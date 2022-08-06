import {
  BeachStatusEnum,
  RoadClosureType,
  RoadClosureTypeEnum,
} from './databaseModels';
import { ScrapedDataReportType } from './globalTypes';

// eslint-disable-next-line max-len
export const closureDateRegexp = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday).+(January|February|March|April|May|June|July|August|September|October|November|December)[^\d]+(\d\d?)[^d]+(\d{4})/i;
export const primaryDateRegexp = /primary/i;
export const timeRegexp = /(\d\d?):(\d\d) (a|p)/i;
export const dateRangeRegexp = /((\d?\d:\d\d [ap])[^\d]+(\d?\d:\d\d [ap]).+)+/gi;

export interface ClosureDataReportType extends ScrapedDataReportType {
  data: RoadClosureType[] | null,
};

export const closureBeachStatusToString: Record<BeachStatusEnum, string> = {
  [BeachStatusEnum.CLOSURE_CANCELED]: 'Closure Canceled',
  [BeachStatusEnum.CLOSURE_SCHEDULED]: 'Closure Scheduled',
  [BeachStatusEnum.CLOSURE_POSSIBLE]: 'Closure Possible',
};

export const closureTypeToString: Record<RoadClosureTypeEnum, string> = {
  [RoadClosureTypeEnum.PRIMARY]: 'Primary Closure',
  [RoadClosureTypeEnum.ALTERNATIVE]: 'Alternative Closure',
};
