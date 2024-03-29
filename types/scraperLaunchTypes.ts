import { ExtendedTimeout, Semaphore } from '../services/util';
import {
  LaunchAffiliationType,
  RocketLaunchType,
} from './databaseModels';
import { ScrapedDataReportType } from './globalTypes';

export const affiliationArray: {
  tag: string,
  group: LaunchAffiliationType,
}[] = [
  { tag: 'Rocket Lab', group: LaunchAffiliationType.ROCKET_LAB },
  { tag: 'SpaceX', group: LaunchAffiliationType.SPACEX },
  { tag: 'Russia', group: LaunchAffiliationType.ROSCOSMOS },
  { tag: 'Northrop Grumman', group: LaunchAffiliationType.NORTHROP_GRUMMAN },
  { tag: 'United Launch Alliance', group: LaunchAffiliationType.UNITED_LAUNCH_ALLIANCE },
  { tag: 'India', group: LaunchAffiliationType.INDIA },
  { tag: 'Arianespace', group: LaunchAffiliationType.ARIANESPACE },
  { tag: 'U.S. Air Force', group: LaunchAffiliationType.US_AIR_FORCE },
  { tag: 'USAF', group: LaunchAffiliationType.US_AIR_FORCE },
  { tag: 'U.S. Space Force', group: LaunchAffiliationType.US_SPACE_FORCE },
  { tag: 'USSF', group: LaunchAffiliationType.US_SPACE_FORCE },
  { tag: 'Astra', group: LaunchAffiliationType.ASTRA },
  { tag: 'Japanese', group: LaunchAffiliationType.JAPAN },
  { tag: 'Japan', group: LaunchAffiliationType.JAPAN },
  { tag: 'JAXA', group: LaunchAffiliationType.JAPAN },
  { tag: 'International Space Station', group: LaunchAffiliationType.INTERNATIONAL_SPACE_STATION },
  { tag: 'Space Launch System', group: LaunchAffiliationType.SPACE_LAUNCH_SYSTEM },
  { tag: 'SLS', group: LaunchAffiliationType.SPACE_LAUNCH_SYSTEM },
];

export const defaultLaunchPrototypeObject: {
  affiliations: LaunchAffiliationType[],
  date: string | null,
  description: string | null,
  launchSite: string | null,
  mission: string | null,
  timeData: string | null,
  vehicle: string | null,
} = {
  affiliations: [],
  date: null,
  description: null,
  launchSite: null,
  mission: null,
  timeData: null,
  vehicle: null,
};

export const getAffiliations = (description: string) : LaunchAffiliationType[] => Array.from(
  new Set(
    affiliationArray
      .filter(
        ({ tag }) => (description.indexOf(tag) > -1),
      )
      .map(
        ({ group }) => group,
      ),
  ),
);

export interface RocketLaunchDataReportType extends ScrapedDataReportType {
  data: RocketLaunchType[] | null,
};

export const seasonToMonth: Record<string, number> = {
  SPRING: 2,
  SUMMER: 5,
  FALL: 8,
  WINTER: 11,
};

export const quarterToMonth: Record<string, number> = {
  '1ST': 0,
  '2ND': 3,
  '3RD': 6,
  '4TH': 9,
};

export const regexps = {
  date: {
    abbreviatedMonthAndDay: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Oct|Nov|Dec)\.? +(\d\d?)/i,
    // eslint-disable-next-line max-len
    fullMonthAndDay: /(January|February|March|April|May|June|July|August|September|October|November|December) +(\d\d?)/i,
    month: /(January|February|March|April|May|June|July|August|September|October|November|December)/i,
    quarter: /(1st|2nd|3rd|4th) +Quarter/i,
    season: /(Spring|Summer|Fall|Winter)/i,
    year: /.+[ -](\d{4})/,
  },
  time: {
    standardTime: /^(\d\d)(\d\d) UTC/,
    standardTimeWithSeconds: /^(\d\d)(\d\d):(\d\d) UTC/,
    approximateTime: /(Approx\.|Approximately) (\d\d)(\d\d)(:\d\d)? UTC/,
    launchWindow: /(\d\d)(\d\d)-(\d\d)(\d\d) UTC/,
    launchWindowWithSeconds: /./,
    flexibleTime: /./,
  },
};

export const launchReminderLock = new Semaphore(1);

export const pendingLaunchReminders: Record<
  string,
  [ExtendedTimeout | undefined, ExtendedTimeout | undefined] | undefined
> = {};
