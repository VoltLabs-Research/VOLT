import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ISecretKeyRepository } from '@modules/team/domain/ports/ISecretKeyRepository';
import { DeleteSecretKeyByIdInputDTO } from '@modules/team/application/dtos/secret-key/DeleteSecretKeyByIdDTO';

@injectable()
export default class DeleteSecretKeyByIdUseCase implements IUseCase<DeleteSecretKeyByIdInputDTO, null, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository)
        private readonly secretKeyRepository: ISecretKeyRepository
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

        return Result.ok(null);
    }
}
