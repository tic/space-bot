/* eslint-disable no-unused-vars */
/* eslint-disable no-shadow */

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
