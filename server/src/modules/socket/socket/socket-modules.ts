import eventBroadcastSocketModule from '@modules/socket/socket/EventBroadcastSocketModule';
import type { ISocketModule } from '@modules/socket/socket/ISocketModule';
import teamSubscriptionSocketModule from '@modules/socket/socket/team-subscription/TeamSubscriptionSocketModule';

export const socketModules: ISocketModule[] = [
    eventBroadcastSocketModule,
    teamSubscriptionSocketModule
];
