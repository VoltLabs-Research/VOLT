import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ISecretKeyRepository } from '@modules/team/domain/ports/ISecretKeyRepository';
import { ISecretKeyUsageLogRepository } from '@modules/team/domain/ports/ISecretKeyUsageLogRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import {
    GetSecretKeyUsageInputDTO,
    GetSecretKeyUsageOutputDTO
} from '@modules/team/application/dtos/secret-key/GetSecretKeyUsageDTO';

@injectable()
export default class GetSecretKeyUsageUseCase
    implements IUseCase<GetSecretKeyUsageInputDTO, GetSecretKeyUsageOutputDTO, ApplicationError> {

    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository)
        private readonly secretKeyRepo: ISecretKeyRepository,

        @inject(TEAM_TOKENS.SecretKeyUsageLogRepository)
        private readonly usageLogRepo: ISecretKeyUsageLogRepository
    ) {}

    async execute(input: GetSecretKeyUsageInputDTO): Promise<Result<GetSecretKeyUsageOutputDTO, ApplicationError>> {
        const { teamId, secretKeyId, days = 30 } = input;

        if (!teamId || !secretKeyId) {
            return Result.fail(ApplicationError.badRequest(ErrorCodes.SECRET_KEY_PARAMS_REQUIRED, 'Team ID and Secret Key ID are required'));
        }

        const secretKey = await this.secretKeyRepo.findById(secretKeyId, {
            populate: { path: 'role', select: ['name'] } as any
        });

        if (!secretKey || String(secretKey.props.team) !== teamId) {
            return Result.fail(ApplicationError.notFound(ErrorCodes.SECRET_KEY_NOT_FOUND, 'Secret key not found'));
        }

        const metrics = await this.usageLogRepo.getKeyMetrics(secretKeyId, days);
        const role = secretKey.props.role as any;

        return Result.ok({
            key: {
                id: secretKey.id,
                name: secretKey.props.name,
                keyPrefix: secretKey.props.keyPrefix,
                roleName: role?.name || 'Unknown',
                isActive: secretKey.props.isActive,
                createdAt: secretKey.props.createdAt,
                lastUsedAt: secretKey.props.lastUsedAt || null
            },
            ...metrics
        });
    }
}
