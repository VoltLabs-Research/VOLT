import UserDeletedEvent from '@modules/auth/events/UserDeletedEvent';
import TeamMemberModel from '@modules/team/models/team-member/TeamMemberModel';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';

class UserDeletedEventHandler implements IEventHandler<UserDeletedEvent>{
    async handle(event: UserDeletedEvent): Promise<void> {
        const { userId } = event.payload;
        await TeamMemberModel.deleteMany({ user: userId });
    }
};

const userDeletedEventHandler = new UserDeletedEventHandler();
subscribeHandler('user.deleted', userDeletedEventHandler);

export default userDeletedEventHandler;
