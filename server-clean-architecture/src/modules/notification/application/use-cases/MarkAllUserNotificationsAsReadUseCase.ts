import { INotificationRepository } from "../../domain/port/INotificationRepository";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { MarkAllUserNotificationsAsReadInputDTO } from "../dtos/MarkAllUserNotificationsAsReadDTO";
import { NOTIFICATION_TOKENS } from '../../infrastructure/di/NotificationTokens';
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