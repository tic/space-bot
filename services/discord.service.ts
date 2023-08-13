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
import { logError, logMessage } from './logger.service';
import {
  ExtendedTimeout,
  Semaphore,
  sleep,
} from './util';
import { LogCategoriesEnum } from '../types/serviceLoggerTypes';

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

  client.on('messageCreate', (message) => {
    if (message.content === '!sb-timeouts') {
      const timeouts = ExtendedTimeout.getActiveTimeouts()
        .filter((to) => to.id.startsWith('launch_'))
        .map((to) => ({ ...to, id: to.id.substring(7) }))
        .sort((a, b) => a.trigger - b.trigger);

      let i = 1;
      const maxI = Math.ceil(timeouts.length / 20);
      const embeds = [];
      while (timeouts.length > 0) {
        embeds.push(
          new MessageEmbed()
            .setColor('#ffee00')
            .setTitle(`Active Launch Timeouts (${i}/${maxI})`)
            .addFields(
              timeouts.splice(0, 20).map(
                (to) => ({
                  name: to.id,
                  value: `<t:${Math.floor(to.trigger / 1000)}:F>`,
                  inline: true,
                }),
              ),
            )
            .setTimestamp(),
        );

        i++;
      }

      try {
        if (embeds.length > 0) {
          message.channel.send({ embeds });
        } else {
          message.channel.send('No active timeouts!');
        }
      } catch (err0) {
        try {
          message.channel.send(`Unable to generate active timeouts report:\n${String(err0)}`);
        } catch (err1) {
          logError(LogCategoriesEnum.ANNOUNCE_FAILURE, 'command response', err1);
        }
      }
    }
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
        return roleId ? `<@&${roleId}>` : roleName;
      }).sort().join(' ');
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
