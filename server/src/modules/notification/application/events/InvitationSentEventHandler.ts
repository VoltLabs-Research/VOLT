import { CreateNotificationUseCase } from '@modules/notification/application/use-cases';
import { inject, injectable } from 'tsyringe';
import type { InvitationSentIntegrationEvent } from '@shared/application/contracts/events/InvitationSentIntegrationEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

@injectable()
export default class InvitationSentEventHandler implements IEventHandler<InvitationSentIntegrationEvent>{
    constructor(
        @inject(CreateNotificationUseCase)
        private readonly createNotificationUseCase: CreateNotificationUseCase
    ){}

    async handle(event: InvitationSentIntegrationEvent): Promise<void>{
        const { teamName, invitedUserId, invitationId } = event.payload;

        await this.createNotificationUseCase.execute({
            recipient: invitedUserId,
            title: 'Team Invitation',
            content: `You have been invited to join the team "${teamName}"`,
            link: `/team-invitation/${invitationId}`
        });
    }
};
