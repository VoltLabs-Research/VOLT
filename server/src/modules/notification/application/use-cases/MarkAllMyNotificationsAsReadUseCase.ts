import type { MarkAllMyNotificationsAsReadInputDTO } from '@modules/notification/application/dtos';
import type { INotificationRepository } from '@modules/notification/domain/port/INotificationRepository';
import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class MarkAllMyNotificationsAsReadUseCase implements IUseCase<MarkAllMyNotificationsAsReadInputDTO, void, ApplicationError> {
    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationRepository) private readonly notificationRepo: INotificationRepository
    ) {}

    async execute(input: MarkAllMyNotificationsAsReadInputDTO): Promise<Result<void, ApplicationError>>{
        const { userId } = input;
        const result = await this.notificationRepo.markAllAsRead(userId);
        return Result.ok(result);
    }
}
