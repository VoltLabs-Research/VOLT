import type {
    GetMyNotificationsInputDTO,
    GetMyNotificationsOutputDTO,
    MarkAllMyNotificationsAsReadInputDTO
} from '@modules/notification/application/dtos';
import GetMyNotificationsUseCase from '@modules/notification/application/use-cases/GetMyNotificationsUseCase';
import type { INotificationRepository } from '@modules/notification/domain/port/INotificationRepository';
import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The single application service for the notification module. Each method folds
 * the exact logic of a previously separate use case, converting the Result error
 * channel to thrown `ApplicationError`s so Express 5 forwards them to the global
 * error middleware. `getMyNotifications` delegates to the retained
 * {@link GetMyNotificationsUseCase} (still consumed by the notifications AI
 * tool), mirroring the auth module's `updateAccount` delegator.
 */
@Singleton(NOTIFICATION_TOKENS.NotificationService)
export default class NotificationService {
    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationRepository) private readonly notificationRepo: INotificationRepository,
        @inject(GetMyNotificationsUseCase) private readonly getMyNotificationsUseCase: GetMyNotificationsUseCase
    ) {}

    /**
     * Thin delegator to the retained {@link GetMyNotificationsUseCase} (still
     * used by the notifications AI tool). Unwraps the Result to the thrown-error
     * channel used by every other NotificationService method.
     */
    async getMyNotifications(input: GetMyNotificationsInputDTO): Promise<GetMyNotificationsOutputDTO> {
        const result = await this.getMyNotificationsUseCase.execute(input);
        if (!result.success) {
            throw result.error;
        }

        return result.value;
    }

    async markAllAsRead(input: MarkAllMyNotificationsAsReadInputDTO): Promise<void> {
        const { userId } = input;
        const result = await this.notificationRepo.markAllAsRead(userId);
        return result;
    }
}
