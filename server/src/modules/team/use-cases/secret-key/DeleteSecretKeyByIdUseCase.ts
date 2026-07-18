import type { ISecretKeyRepository } from '@modules/team/ports/secret-key/ISecretKeyRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { DeleteSecretKeyByIdInputDTO } from '@modules/team/dtos/secret-key/DeleteSecretKeyByIdDTO';
import SecretKeyDeletedEvent from '@modules/team/events/secret-key/SecretKeyDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class DeleteSecretKeyByIdUseCase implements IUseCase<DeleteSecretKeyByIdInputDTO, null> {
    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository) private readonly secretKeyRepository: ISecretKeyRepository,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: DeleteSecretKeyByIdInputDTO): Promise<null> {
        if (!input.userId) {
            throw ApplicationError.badRequest(
                ErrorCodes.SECRET_KEY_PARAMS_REQUIRED,
                'User ID is required'
            );
        }

        const key = await this.secretKeyRepository.findById(input.secretKeyId);

        if (!key || key.props.team !== input.teamId) {
            throw ApplicationError.notFound(
                ErrorCodes.SECRET_KEY_NOT_FOUND,
                'Secret key not found'
            );
        }

        await this.secretKeyRepository.deleteById(key._id);

        await this.eventBus.publish(new SecretKeyDeletedEvent({
            secretKeyId: key._id,
            teamId: input.teamId,
            userId: input.userId,
            secretKeyName: key.props.name ?? ''
        }));

        return null;
    }
}
