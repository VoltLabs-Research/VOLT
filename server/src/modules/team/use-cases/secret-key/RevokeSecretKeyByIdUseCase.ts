import type { ISecretKeyRepository } from '@modules/team/ports/secret-key/ISecretKeyRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { RevokeSecretKeyByIdInputDTO, RevokeSecretKeyByIdOutputDTO } from '@modules/team/dtos/secret-key/RevokeSecretKeyByIdDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class RevokeSecretKeyByIdUseCase implements IUseCase<RevokeSecretKeyByIdInputDTO, RevokeSecretKeyByIdOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository) private readonly secretKeyRepository: ISecretKeyRepository
    ) {}

    async execute(input: RevokeSecretKeyByIdInputDTO): Promise<RevokeSecretKeyByIdOutputDTO> {
        const key = await this.secretKeyRepository.findById(input.secretKeyId);

        if (!key || key.props.team !== input.teamId) {
            throw ApplicationError.notFound(
                ErrorCodes.SECRET_KEY_NOT_FOUND,
                'Secret key not found'
            );
        }

        const updated = await this.secretKeyRepository.updateById(key._id, {
            isActive: false,
            updatedAt: new Date()
        });

        if (!updated) {
            throw ApplicationError.notFound(
                ErrorCodes.SECRET_KEY_NOT_FOUND,
                'Secret key not found'
            );
        }

        return {
            _id: updated._id,
            teamId: input.teamId,
            isActive: updated.props.isActive,
            updatedAt: updated.props.updatedAt
        };
    }
}
