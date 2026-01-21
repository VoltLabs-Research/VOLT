import { INotificationRepository } from '@modules/notification/domain/port/INotificationRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { injectable, inject } from 'tsyringe';
import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { CreateNotificationInputDTO, CreateNotificationOutputDTO } from '@modules/notification/application/dtos/CreateNotificationDTO';
import NotificationCreatedEvent from '@modules/notification/domain/events/NotificationCreatedEvent';

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
            notificationId: notification.id,
            recipient: notification.props.recipient,
            title: notification.props.title,
            content: notification.props.content,
            read: notification.props.read,
            link: notification.props.link,
            createdAt: notification.props.createdAt
        }));

        return Result.ok({
            id: notification.id,
            ...notification.props
        });
    }
}
