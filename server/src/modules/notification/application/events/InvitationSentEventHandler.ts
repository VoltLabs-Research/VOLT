import { CreateNotificationUseCase } from '@modules/notification/application/use-cases';
import type { InvitationSentIntegrationEvent } from '@shared/application/contracts/events/InvitationSentIntegrationEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('invitation.sent')
export default class InvitationSentEventHandler implements IEventHandler<InvitationSentIntegrationEvent> {
    constructor(
        private readonly createNotificationUseCase: CreateNotificationUseCase
    ) {}

    async handle(event: InvitationSentIntegrationEvent): Promise<void>{
        const { teamName, invitedUserId, invitationId } = event.payload;

        await this.createNotificationUseCase.execute({
            recipient: invitedUserId,
            title: 'Team Invitation',
            content: `You have been invited to join the team "${teamName}"`,
            link: `/team-invitation/${invitationId}`
        });
    }
}
