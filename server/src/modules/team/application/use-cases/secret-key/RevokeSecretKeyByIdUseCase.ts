import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ISecretKeyRepository } from '@modules/team/domain/ports/ISecretKeyRepository';
import {
    RevokeSecretKeyByIdInputDTO,
    RevokeSecretKeyByIdOutputDTO
} from '@modules/team/application/dtos/secret-key/RevokeSecretKeyByIdDTO';

@injectable()
export default class RevokeSecretKeyByIdUseCase implements IUseCase<RevokeSecretKeyByIdInputDTO, RevokeSecretKeyByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository)
        private readonly secretKeyRepository: ISecretKeyRepository
    ) {}

    async execute(input: RevokeSecretKeyByIdInputDTO): Promise<Result<RevokeSecretKeyByIdOutputDTO, ApplicationError>> {
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

        const updated = await this.secretKeyRepository.updateById(key.id, {
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
            _id: updated.id,
            teamId: String(updated.props.team),
            isActive: updated.props.isActive,
            updatedAt: updated.props.updatedAt
        });
    }
}
