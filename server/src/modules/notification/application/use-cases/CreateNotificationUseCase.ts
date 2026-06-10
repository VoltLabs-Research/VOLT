import type { CreateNotificationInputDTO, PersistedNotificationDTO } from '@modules/notification/application/dtos';
import type { INotificationRepository } from '@modules/notification/domain/port/INotificationRepository';
import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class CreateNotificationUseCase implements IUseCase<CreateNotificationInputDTO, PersistedNotificationDTO, ApplicationError> {
    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationRepository) private readonly notificationRepository: INotificationRepository
    ) { }

    async execute(input: CreateNotificationInputDTO): Promise<Result<PersistedNotificationDTO, ApplicationError>> {
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

        return Result.ok({
            _id: notification._id,
            ...notification.props
        });
    }
}
