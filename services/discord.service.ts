import {
  Client,
  ClientOptions,
  MessageEmbed,
  Intents,
} from 'discord.js';
import { config } from '../config';
import { ChannelClassEnum } from '../types/serviceDiscordTypes';
import { logMessage } from './logger.service';

const options: ClientOptions = {
  intents: new Intents(32767),
};
const client = new Client(options);

export const initialize = () => {
  client.login(config.discord.secret);
  client.on('ready', () => {
    logMessage('service.discord.initialize', `${config.discord.username} has logged in.`);
  });
};

export const announce = async (
  channelClass: ChannelClassEnum,
  message?: string,
  embed?: MessageEmbed,
  taggedRoles: string[] = [],
) : Promise<boolean> => {
  if (message === undefined && embed === undefined && taggedRoles.length === 0) {
    return false;
  }
  return true;
};
