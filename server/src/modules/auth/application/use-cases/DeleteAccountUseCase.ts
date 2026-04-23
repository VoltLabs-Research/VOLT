import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteAccountInputDTO, DeleteAccountOutputDTO } from '@modules/auth/application/dtos/DeleteAccountDTO';
import UserDeletedEvent from '@modules/auth/domain/events/UserDeletedEvent';
import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DeleteAccountUseCase implements IUseCase<DeleteAccountInputDTO, DeleteAccountOutputDTO, ApplicationError>{
    constructor(
        
        private readonly userRepository: UserRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
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
};
