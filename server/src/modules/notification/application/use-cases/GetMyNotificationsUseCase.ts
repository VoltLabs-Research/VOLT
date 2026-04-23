import type { GetMyNotificationsInputDTO, GetMyNotificationsOutputDTO } from '@modules/notification/application/dtos';
import NotificationRepository from '@modules/notification/infrastructure/persistence/mongo/repositories/NotificationRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class GetMyNotificationsUseCase
    implements IUseCase<GetMyNotificationsInputDTO, GetMyNotificationsOutputDTO, ApplicationError> {

    constructor(
        
        private notificationRepo: NotificationRepository
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
