import type { CreateNotificationInputDTO, PersistedNotificationDTO } from '@modules/notification/application/dtos';
import NotificationCreatedEvent from '@modules/notification/domain/events/NotificationCreatedEvent';
import NotificationRepository from '@modules/notification/infrastructure/persistence/mongo/repositories/NotificationRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class CreateNotificationUseCase implements IUseCase<CreateNotificationInputDTO, PersistedNotificationDTO, ApplicationError> {
    constructor(
        
        private readonly notificationRepository: NotificationRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
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

        // Publish event for real-time socket delivery
        await this.eventBus.publish(new NotificationCreatedEvent({
            _id: notification._id,
            recipient: notification.props.recipient,
            title: notification.props.title,
            content: notification.props.content,
            read: notification.props.read,
            link: notification.props.link,
            createdAt: notification.props.createdAt
        }));

        return Result.ok({
            _id: notification._id,
            ...notification.props
        });
    }
};
