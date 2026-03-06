import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ISecretKeyRepository } from '@modules/team/domain/port/ISecretKeyRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import SecretKeyDeletedEvent from '@modules/team/domain/events/SecretKeyDeletedEvent';
import { DeleteSecretKeyByIdInputDTO } from '@modules/team/application/dtos/secret-key/DeleteSecretKeyByIdDTO';

@injectable()
export default class DeleteSecretKeyByIdUseCase implements IUseCase<DeleteSecretKeyByIdInputDTO, null, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository)
        private readonly secretKeyRepository: ISecretKeyRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: DeleteSecretKeyByIdInputDTO): Promise<Result<null, ApplicationError>> {
        const key = await this.secretKeyRepository.findOne({
            _id: input.secretKeyId,
            team: input.teamId
        } as any);

        if (!key) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SECRET_KEY_NOT_FOUND,
                'Secret key not found'
            ));
        }

        await this.secretKeyRepository.deleteById(key.id);

        await this.eventBus.publish(new SecretKeyDeletedEvent({
            secretKeyId: key.id,
            teamId: input.teamId
        }));

        return Result.ok(null);
    }
}
