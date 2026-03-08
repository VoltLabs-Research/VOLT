import { INotificationRepository } from '@modules/notification/domain/port/INotificationRepository';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import { injectable, inject } from 'tsyringe';
import { GetMyNotificationsInputDTO, GetMyNotificationsOutputDTO } from '@modules/notification/application/dtos/GetMyNotificationsDTO';

@injectable()
export default class GetMyNotificationsUseCase
    implements IUseCase<GetMyNotificationsInputDTO, GetMyNotificationsOutputDTO, ApplicationError> {

    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationRepository)
        private notificationRepo: INotificationRepository
    ){}

    async execute(input: GetMyNotificationsInputDTO): Promise<Result<GetMyNotificationsOutputDTO, ApplicationError>> {
        const { userId } = input;
        const result = await this.notificationRepo.findAll({
            filter: { recipient: userId },
            sort: { createdAt: -1 },
            page: input.page,
            limit: input.limit
        });

        return Result.ok({
            data: result.data.map((notification) => ({ _id: notification._id, ...notification.props })),
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
        });
    }
};
