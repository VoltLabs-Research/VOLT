import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteAccountInputDTO, DeleteAccountOutputDTO } from '@modules/auth/application/dtos/DeleteAccountDTO';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import UserDeletedEvent from '@modules/auth/domain/events/UserDeletedEvent';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import type { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DeleteAccountUseCase implements IUseCase<DeleteAccountInputDTO, DeleteAccountOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository) private readonly userRepository: IUserRepository,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ) {}

    async execute(input: DeleteAccountInputDTO): Promise<Result<DeleteAccountOutputDTO, ApplicationError>>{
        const user = await this.userRepository.findById(input.userId);
        if(!user){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'User not found'
            ));
        }

        const deleted = await this.userRepository.deleteById(input.userId);
        if (deleted) {
            await this.eventBus.publish(new UserDeletedEvent({
                userId: input.userId
            }));
        }

        return Result.ok({ success: true });
    }
}
