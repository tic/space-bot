import {
  Collection,
  MongoClient,
} from 'mongodb';
import { config } from '../config';
import {
  ChangeItemType,
  ChangeReportTypeEnum,
  ScrapedDataReportType,
  ScrapedDataType,
} from '../types/globalTypes';
import { LogCategoriesEnum } from '../types/serviceLoggerTypes';
import { logError } from './logger.service';

export const client = new MongoClient(
  `mongodb+srv://${
    config.mongo.username
  }:${
    config.mongo.password
  }@${
    config.mongo.url
  }/${
    config.mongo.primaryDatabase
  }?retryWrites=true&w=majority`,
  {
    serverSelectionTimeoutMS: 10000,
  },
);

export const collections = {
  roadClosures: client.db(config.mongo.primaryDatabase).collection('roadClosures'),
  notams: client.db(config.mongo.primaryDatabase).collection('notams'),
  launches: client.db(config.mongo.primaryDatabase).collection('launches'),
  weather: client.db(config.mongo.primaryDatabase).collection('weather'),
  boosters: client.db(config.mongo.primaryDatabase).collection('boosters'),
};

export const createBulkWriteArray = async (
  collection: Collection,
  findClause: Record<string, any>,
  { data }: ScrapedDataReportType,
  // eslint-disable-next-line no-unused-vars
  matchFunction: (currentDbItem: any) => (testDbItem: any) => boolean,
  // eslint-disable-next-line no-unused-vars
  generateUpdateFilter: (dbItem: any) => Object,
) => {
  try {
    if (data === null) {
      return {
        bulkWriteArray: [],
        changeItems: [],
      };
    }
    const matchingObjectsInDbWithId = await collection.find(findClause).toArray();
    const matchingObjectsInDbWithoutId = matchingObjectsInDbWithId.map((dbItem) => {
      const returnObj: Record<string, any> = {};
      Object.entries(dbItem).forEach(([key, value]) => {
        if (key !== '_id') {
          returnObj[key] = value;
        }
      });
      return returnObj;
    });
    const changeItems: ChangeItemType[] = [];
    const bulkWriteArray = data.map((dbItem) => {
      const existingItem = matchingObjectsInDbWithoutId.find(matchFunction(dbItem));
      const changeType = existingItem ? ChangeReportTypeEnum.UPDATED : ChangeReportTypeEnum.NEW;
      if (!existingItem || JSON.stringify(existingItem) !== JSON.stringify(dbItem)) {
        changeItems.push({
          changeType,
          data: dbItem,
          originalData: existingItem as ScrapedDataType,
        });
        return {
          updateOne: {
            filter: generateUpdateFilter(dbItem),
            update: { $set: { ...dbItem } },
            upsert: true,
          },
        };
      }
      return null;
    });
    type ArrayItemReturnType = {
      updateOne: {
        filter: Object,
        update: Object,
        upsert: boolean,
      },
    };
    return {
      bulkWriteArray: bulkWriteArray.filter((arrayItem) => arrayItem !== null) as ArrayItemReturnType[],
      changeItems,
    };
  } catch (error) {
    logError(LogCategoriesEnum.DB_MERGE_FAILURE, 'database_createBulkWriteArray', String(error));
    return {
      bulkWriteArray: [],
      changeItems: [],
    };
  }
};
