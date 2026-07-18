import type { CreateNotificationInputDTO, PersistedNotificationDTO } from '@modules/notification/dtos';
import type { INotificationRepository } from '@modules/notification/ports/INotificationRepository';
import { NOTIFICATION_TOKENS } from '@modules/notification/di/NotificationTokens';
import type { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class CreateNotificationUseCase implements IUseCase<CreateNotificationInputDTO, PersistedNotificationDTO> {
    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationRepository) private readonly notificationRepository: INotificationRepository
    ) { }

    async execute(input: CreateNotificationInputDTO): Promise<PersistedNotificationDTO> {
        const { recipient, title, content, link } = input;

        const notification = await this.notificationRepository.create({
            recipient,
            title,
            content,
            link,
            read: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return {
            _id: notification._id,
            ...notification.props
        };
    }
}
