import type { GetMyNotificationsInputDTO, GetMyNotificationsOutputDTO } from '@modules/notification/application/dtos';
import type { INotificationRepository } from '@modules/notification/domain/port/INotificationRepository';
import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import type { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class GetMyNotificationsUseCase
    implements IUseCase<GetMyNotificationsInputDTO, GetMyNotificationsOutputDTO> {

    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationRepository) private readonly notificationRepo: INotificationRepository
    ) {}

    async execute(input: GetMyNotificationsInputDTO): Promise<GetMyNotificationsOutputDTO> {
        const { userId } = input;
        const result = await this.notificationRepo.findAll({
            filter: { recipient: userId },
            sort: { createdAt: -1 },
            page: input.page,
            limit: input.limit
        });

        return {
            data: result.data.map((notification) => ({ _id: notification._id, ...notification.props })),
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
        };
    }
}
