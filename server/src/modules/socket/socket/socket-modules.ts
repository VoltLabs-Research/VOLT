import eventBroadcastSocketModule from '@modules/socket/socket/EventBroadcastSocketModule';
import teamSubscriptionSocketModule from '@modules/socket/socket/team-subscription/TeamSubscriptionSocketModule';
import type { ISocketModule } from '@modules/socket/ports/ISocketModule';

export const socketModules: ISocketModule[] = [
    eventBroadcastSocketModule,
    teamSubscriptionSocketModule
];
