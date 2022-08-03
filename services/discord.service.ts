import {
  Client,
  ClientOptions,
  MessageEmbed,
  Intents,
  Message,
} from 'discord.js';
import { config } from '../config';
import { ChannelClassEnum } from '../types/serviceDiscordTypes';
import { logMessage } from './logger.service';

const options: ClientOptions = {
  intents: new Intents(32767),
};
const client = new Client(options);

const messageQueue: Message[] = [];

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
  if (message === undefined && embed === undefined) {
    return false;
  }
  config.discord.servers.forEach((server) => {
    const destinationChannels = server.channels[channelClass];
    if (!destinationChannels || destinationChannels.length === 0) {
      return;
    }
    
  });
  return true;
};
