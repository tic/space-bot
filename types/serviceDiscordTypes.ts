/* eslint-disable no-unused-vars */
/* eslint-disable no-shadow */

export enum ChannelClassEnum {
  GENERAL = 'GENERAL',
  BOOSTER_UPDATE = 'BOOSTER_UPDATE',
  WEATHER_UPDATE = 'WEATHER_UPDATE',
  NOTAM_UPDATE = 'NOTAM_UPDATE',
  CLOSURE_UPDATE = 'CLOSURE_UPDATE',
  LAUNCH_UPDATE = 'LAUNCH_UPDATE',
  LAUNCH_REMINDER = 'LAUNCH_REMINDER',
};

export type DiscordRoleType = {
  id: string,
  name: string,
};

export type DiscordChannelType = {
  id: string,
};

export type DiscordServerType = {
  name: string,
  id: string,
  roles: DiscordRoleType[],
  channels: Record<ChannelClassEnum, DiscordChannelType[]>,
};
