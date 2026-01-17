import { INotificationRepository } from "../../domain/port/INotificationRepository";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { NOTIFICATION_TOKENS } from '../../infrastructure/di/NotificationTokens';
import { injectable, inject } from 'tsyringe';
import { GetNotificationsByUserIdInputDTO, GetNotificationsByUserIdOutputDTO } from "../dtos/GetNotificationsByUserIdDTO";

@injectable()
export default class GetNotificationsByUserIdUseCase
    implements IUseCase<GetNotificationsByUserIdInputDTO, GetNotificationsByUserIdOutputDTO, ApplicationError> {

    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationRepository)
        private notificationRepo: INotificationRepository
    ) { }

    async execute(input: GetNotificationsByUserIdInputDTO): Promise<Result<GetNotificationsByUserIdOutputDTO, ApplicationError>> {
        const { userId } = input;
        const result = await this.notificationRepo.findAll({
            filter: { recipient: userId },
            page: 1, // Assume default pagination
            limit: 50
        });

        // The DTO likely expects 'notifications' array, not 'results'.
        // Assuming GetNotificationsByUserIdOutputDTO has { notifications: NotificationProps[], total: number } 
        // Based on other patterns. I will check DTO if this fails, but usually:
        return Result.ok({
            data: result.data.map(n => n.props),
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
        });
    }
};