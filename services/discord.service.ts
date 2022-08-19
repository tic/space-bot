import {
  Client,
  ClientOptions,
  MessageEmbed,
  Intents,
  MessagePayload,
  MessageOptions,
  TextChannel,
} from 'discord.js';
import { config } from '../config';
import { ChannelClassEnum } from '../types/serviceDiscordTypes';
import { logMessage } from './logger.service';
import {
  Semaphore,
  sleep,
} from './util';

const options: ClientOptions = {
  intents: new Intents()
    .add(Intents.FLAGS.DIRECT_MESSAGES)
    .add(Intents.FLAGS.GUILDS)
    .add(Intents.FLAGS.GUILD_MESSAGES)
    .add(Intents.FLAGS.GUILD_MESSAGE_REACTIONS),
};
const client = new Client(options);

const messageQueue: MessagePayload[] = [];
const queueLock = new Semaphore(1);
const throttleMessages = async () => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    while (messageQueue.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      const release = await queueLock.acquire();
      const messagePayload = messageQueue.shift() as MessagePayload;
      (messagePayload.target as TextChannel).send(messagePayload);
      release();
      // eslint-disable-next-line no-await-in-loop
      await sleep(3000);
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(60000);
  }
};

export const initialize = () => {
  client.login(config.discord.secret);
  client.on('ready', () => {
    logMessage('service.discord.initialize', `${config.discord.username} has logged in.`);
    throttleMessages();
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
  const release = await queueLock.acquire();
  config.discord.servers.forEach((server) => {
    const destinationChannels = server.channels[channelClass];
    if (!destinationChannels || destinationChannels.length === 0) {
      return;
    }
    const messageOptions = {
      embeds: [embed],
    } as MessageOptions;
    if (taggedRoles.length > 0 || message) {
      const messageText = message || '';
      const roleContent = taggedRoles.map((roleName) => {
        const roleId = server.roles.find((role) => role.name === roleName)?.id;
        return roleId ? `<@&${roleId}>` : '';
      }).join(' ');
      messageOptions.content = roleContent.length > 0
        ? `${messageText}${messageText.length > 0 ? '\n' : roleContent}`
        : messageText;
    }
    destinationChannels.forEach((rawChannel) => {
      const channel = client.channels.cache.get(rawChannel.id);
      if (channel && channel.isText()) {
        messageQueue.push(new MessagePayload(
          channel,
          messageOptions,
        ));
      }
    });
  });
  release();
  return true;
};
