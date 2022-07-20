import { MongoClient } from 'mongodb';
import { config } from '../config';

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
