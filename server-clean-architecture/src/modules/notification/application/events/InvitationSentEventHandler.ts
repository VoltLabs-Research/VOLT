import { IEventHandler } from '@shared/application/events/IEventHandler';
import { injectable, inject } from 'tsyringe';
import InvitationSentEvent from '@modules/team/domain/events/InvitationSentEvent';
import CreateNotificationUseCase from '../use-cases/CreateNotificationUseCase';

@injectable()
export default class InvitationSentEventHandler implements IEventHandler<InvitationSentEvent>{
    constructor(
        @inject(CreateNotificationUseCase)
        private readonly createNotificationUseCase: CreateNotificationUseCase
    ){}

    async handle(event: InvitationSentEvent): Promise<void>{
        const { teamName, invitedUserId, invitationId } = event.payload;

        await this.createNotificationUseCase.execute({
            recipient: invitedUserId,
            title: 'Team Invitation',
            content: `You have been invited to join the team "${teamName}"`,
            link: `/team-invitation/${invitationId}`
        });
    }
};