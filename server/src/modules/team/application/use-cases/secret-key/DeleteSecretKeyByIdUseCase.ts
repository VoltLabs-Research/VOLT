import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { DeleteSecretKeyByIdInputDTO } from '@modules/team/application/dtos/secret-key/DeleteSecretKeyByIdDTO';
import SecretKeyDeletedEvent from '@modules/team/domain/events/secret-key/SecretKeyDeletedEvent';
import { ISecretKeyRepository } from '@modules/team/domain/port/secret-key/ISecretKeyRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class DeleteSecretKeyByIdUseCase implements IUseCase<DeleteSecretKeyByIdInputDTO, null, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository)
        private readonly secretKeyRepository: ISecretKeyRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: DeleteSecretKeyByIdInputDTO): Promise<Result<null, ApplicationError>> {
        if (!input.userId) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.SECRET_KEY_PARAMS_REQUIRED,
                'User ID is required'
            ));
        }

        const key = await this.secretKeyRepository.findById(input.secretKeyId);

        if (!key || key.props.team !== input.teamId) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SECRET_KEY_NOT_FOUND,
                'Secret key not found'
            ));
        }

        await this.secretKeyRepository.deleteById(key._id);

        await this.eventBus.publish(new SecretKeyDeletedEvent({
            secretKeyId: key._id,
            teamId: input.teamId,
            userId: input.userId,
            secretKeyName: key.props.name ?? ''
        }));

        return Result.ok(null);
    }
};
