import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ISecretKeyRepository } from '@modules/team/domain/port/ISecretKeyRepository';
import {
    GetCurrentSecretKeyInputDTO,
    GetCurrentSecretKeyOutputDTO
} from '@modules/team/application/dtos/secret-key/GetCurrentSecretKeyDTO';

@injectable()
export default class GetCurrentSecretKeyUseCase implements IUseCase<GetCurrentSecretKeyInputDTO, GetCurrentSecretKeyOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository)
        private readonly secretKeyRepository: ISecretKeyRepository
    ) {}

    async execute(input: GetCurrentSecretKeyInputDTO): Promise<Result<GetCurrentSecretKeyOutputDTO, ApplicationError>> {
        if (input.authType !== 'secret-key' || !input.secretKeyId) {
            return Result.fail(ApplicationError.unauthorized(
                ErrorCodes.AUTHENTICATION_REQUIRED,
                'Secret key authentication required'
            ));
        }

        const secretKey = await this.secretKeyRepository.findById(input.secretKeyId);
        if (!secretKey) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SECRET_KEY_INVALID,
                'Secret key not found'
            ));
        }

        const role = secretKey.props.role as any;
        const createdBy = secretKey.props.createdBy as any;

        return Result.ok({
            _id: secretKey.id,
            team: typeof secretKey.props.team === 'string'
                ? secretKey.props.team
                : String(secretKey.props.team),
            role: role?._id?.toString?.() || String(secretKey.props.role || ''),
            createdBy: createdBy?._id?.toString?.() || String(secretKey.props.createdBy || ''),
            name: secretKey.props.name,
            keyPrefix: secretKey.props.keyPrefix,
            isActive: secretKey.props.isActive,
            lastUsedAt: secretKey.props.lastUsedAt,
            createdAt: secretKey.props.createdAt,
            updatedAt: secretKey.props.updatedAt
        });
    }
}
