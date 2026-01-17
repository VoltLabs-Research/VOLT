import { INotificationRepository } from "../../domain/port/INotificationRepository";
import { Result } from "@/src/shared/domain/ports/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { IUseCase } from "@/src/shared/application/IUseCase";
import { injectable, inject } from 'tsyringe';
import { NOTIFICATION_TOKENS } from "../../infrastructure/di/NotificationTokens";
import { CreateNotificationInputDTO, CreateNotificationOutputDTO } from "../dtos/CreateNotificationDTO";

@injectable()
export default class CreateNotificationUseCase implements IUseCase<CreateNotificationInputDTO, CreateNotificationOutputDTO, ApplicationError> {
    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationRepository)
        private readonly notificationRepository: INotificationRepository
    ) { }

    async execute(input: CreateNotificationInputDTO): Promise<Result<CreateNotificationOutputDTO, ApplicationError>> {
        const { recipient, title, content, link } = input;

        const notification = await this.notificationRepository.create({
            recipient,
            title,
            content,
            link,
            read: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return Result.ok({
            id: notification.id,
            ...notification.props
        });
    }
}
