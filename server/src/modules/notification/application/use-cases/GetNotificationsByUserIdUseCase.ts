import { INotificationRepository } from '@modules/notification/domain/port/INotificationRepository';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import { injectable, inject } from 'tsyringe';
import { GetNotificationsByUserIdInputDTO, GetNotificationsByUserIdOutputDTO } from '@modules/notification/application/dtos/GetNotificationsByUserIdDTO';

@injectable()
export default class GetNotificationsByUserIdUseCase
    implements IUseCase<GetNotificationsByUserIdInputDTO, GetNotificationsByUserIdOutputDTO, ApplicationError> {

    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationRepository)
        private notificationRepo: INotificationRepository
    ){}

    async execute(input: GetNotificationsByUserIdInputDTO): Promise<Result<GetNotificationsByUserIdOutputDTO, ApplicationError>> {
        const { userId } = input;
        const result = await this.notificationRepo.findAll({
            filter: { recipient: userId },
            page: input.page,
            limit: input.limit
        });

        return Result.ok({
            data: result.data.map(n => ({ id: n.id, ...n.props })),
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
        });
    }
};
