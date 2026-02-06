import { INotificationRepository } from '@modules/notification/domain/port/INotificationRepository';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { MarkAllUserNotificationsAsReadInputDTO } from '@modules/notification/application/dtos/MarkAllUserNotificationsAsReadDTO';
import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class MarkAllUserNotificationsAsReadUseCase implements IUseCase<MarkAllUserNotificationsAsReadInputDTO, void, ApplicationError>{
    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationRepository)
        private notificationRepo: INotificationRepository
    ){}

    async execute(input: MarkAllUserNotificationsAsReadInputDTO): Promise<Result<void, ApplicationError>>{
        const { userId } = input;
        const result = await this.notificationRepo.markAllAsRead(userId);
        return Result.ok(result);
    }
};