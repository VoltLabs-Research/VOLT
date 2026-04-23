import type { MarkAllMyNotificationsAsReadInputDTO } from '@modules/notification/application/dtos';
import NotificationRepository from '@modules/notification/infrastructure/persistence/mongo/repositories/NotificationRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class MarkAllMyNotificationsAsReadUseCase implements IUseCase<MarkAllMyNotificationsAsReadInputDTO, void, ApplicationError>{
    constructor(
        
        private notificationRepo: NotificationRepository
    ){}

    async execute(input: MarkAllMyNotificationsAsReadInputDTO): Promise<Result<void, ApplicationError>>{
        const { userId } = input;
        const result = await this.notificationRepo.markAllAsRead(userId);
        return Result.ok(result);
    }
};
