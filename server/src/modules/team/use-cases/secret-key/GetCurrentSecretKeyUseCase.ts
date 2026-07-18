import type { ISecretKeyRepository } from '@modules/team/ports/secret-key/ISecretKeyRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { GetCurrentSecretKeyInputDTO, GetCurrentSecretKeyOutputDTO } from '@modules/team/dtos/secret-key/GetCurrentSecretKeyDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class GetCurrentSecretKeyUseCase implements IUseCase<GetCurrentSecretKeyInputDTO, GetCurrentSecretKeyOutputDTO> {
    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository) private readonly secretKeyRepository: ISecretKeyRepository
    ) {}

    async execute(input: GetCurrentSecretKeyInputDTO): Promise<GetCurrentSecretKeyOutputDTO> {
        if (input.authType !== 'secret-key' || !input.secretKeyId) {
            throw ApplicationError.unauthorized(
                ErrorCodes.AUTHENTICATION_REQUIRED,
                'Secret key authentication required'
            );
        }

        const secretKey = await this.secretKeyRepository.findById(input.secretKeyId);
        if (!secretKey) {
            throw ApplicationError.notFound(
                ErrorCodes.SECRET_KEY_INVALID,
                'Secret key not found'
            );
        }

        return {
            _id: secretKey._id,
            team: typeof secretKey.props.team === 'string'
                ? secretKey.props.team
                : String(secretKey.props.team),
            role: secretKey.getRoleId(),
            createdBy: secretKey.getCreatedById(),
            name: secretKey.props.name,
            keyPrefix: secretKey.props.keyPrefix,
            isActive: secretKey.props.isActive,
            lastUsedAt: secretKey.props.lastUsedAt,
            createdAt: secretKey.props.createdAt,
            updatedAt: secretKey.props.updatedAt
        };
    }
}
