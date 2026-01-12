import { INotificationRepository } from "../../domain/port/INotificationRepository";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { NOTIFICATION_TOKENS } from '../../infrastructure/di/NotificationTokens';
import { injectable, inject } from 'tsyringe';
import { GetNotificationsByUserIdInputDTO, GetNotificationsByUserIdOutputDTO } from "../dtos/GetNotificationsByUserIdDTO";

@injectable()
export default class GetNotificationsByUserIdUseCase
    implements IUseCase<GetNotificationsByUserIdInputDTO, GetNotificationsByUserIdOutputDTO, ApplicationError>{
    
    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationRepository)
        private notificationRepo: INotificationRepository
    ){}

    async execute(input: GetNotificationsByUserIdInputDTO): Promise<Result<GetNotificationsByUserIdOutputDTO, ApplicationError>>{
        const { userId } = input;
        const result = await this.notificationRepo.findAll({ filter: { recipient: userId }, limit: 100, page: 1 });
        return Result.ok(result);
    }
};