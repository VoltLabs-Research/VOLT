import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import NotificationCreatedEvent from '@modules/notification/domain/events/NotificationCreatedEvent';
import type { CreateNotificationInputDTO, CreateNotificationOutputDTO } from '@modules/notification/application/dtos';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';
import type { INotificationRepository } from '@modules/notification/domain/port/INotificationRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type ApplicationError from '@shared/application/errors/ApplicationErrors';

@injectable()
export default class CreateNotificationUseCase implements IUseCase<CreateNotificationInputDTO, CreateNotificationOutputDTO, ApplicationError> {
    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationRepository)
        private readonly notificationRepository: INotificationRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) { }

    async execute(input: CreateNotificationInputDTO): Promise<Result<CreateNotificationOutputDTO, ApplicationError>> {
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
