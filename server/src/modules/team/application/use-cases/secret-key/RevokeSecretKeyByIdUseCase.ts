import type SecretKeyRepository from '@modules/team/infrastructure/persistence/mongo/repositories/secret-key/SecretKeyRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { RevokeSecretKeyByIdInputDTO, RevokeSecretKeyByIdOutputDTO } from '@modules/team/application/dtos/secret-key/RevokeSecretKeyByIdDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class RevokeSecretKeyByIdUseCase implements IUseCase<RevokeSecretKeyByIdInputDTO, RevokeSecretKeyByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository) private readonly secretKeyRepository: SecretKeyRepository
    ) {}

    async execute(input: RevokeSecretKeyByIdInputDTO): Promise<Result<RevokeSecretKeyByIdOutputDTO, ApplicationError>> {
        const key = await this.secretKeyRepository.findById(input.secretKeyId);

        if (!key || key.props.team !== input.teamId) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SECRET_KEY_NOT_FOUND,
                'Secret key not found'
            ));
        }

        const updated = await this.secretKeyRepository.updateById(key._id, {
            isActive: false,
            updatedAt: new Date()
        });

        if (!updated) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SECRET_KEY_NOT_FOUND,
                'Secret key not found'
            ));
        }

        return Result.ok({
            _id: updated._id,
            teamId: input.teamId,
            isActive: updated.props.isActive,
            updatedAt: updated.props.updatedAt
        });
    }
}
