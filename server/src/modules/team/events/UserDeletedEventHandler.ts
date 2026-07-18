import UserDeletedEvent from '@modules/auth/events/UserDeletedEvent';
import TeamMemberModel from '@modules/team/models/team-member/TeamMemberModel';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('user.deleted')
export default class UserDeletedEventHandler implements IEventHandler<UserDeletedEvent>{
    async handle(event: UserDeletedEvent): Promise<void> {
        const { userId } = event.payload;
        await TeamMemberModel.deleteMany({ user: userId });
    }
};
