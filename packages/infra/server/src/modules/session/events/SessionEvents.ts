import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import Session from '@modules/session/models/Session';

@DefineEventGroup('session')
export default class SessionEvents {
    @Event('user.deleted')
    async deleteUserSessions({ userId }: EventMap['user.deleted']) {
        await Session.delete({ user: userId });
    }
}
