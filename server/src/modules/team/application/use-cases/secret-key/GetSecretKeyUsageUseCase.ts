import type SecretKeyUsageLogRepository from '@modules/team/infrastructure/persistence/mongo/repositories/secret-key/SecretKeyUsageLogRepository';
import type SecretKeyRepository from '@modules/team/infrastructure/persistence/mongo/repositories/secret-key/SecretKeyRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { GetSecretKeyUsageInputDTO, GetSecretKeyUsageOutputDTO } from '@modules/team/application/dtos/secret-key/GetSecretKeyUsageDTO';
import type { ISecretKeyUsageMetricsMapper } from '@modules/team/domain/port/secret-key/ISecretKeyUsageMetricsMapper';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

interface SecretKeyRolePopulate {
    path: 'role';
    select: ['name'];
}

@injectable()
export default class GetSecretKeyUsageUseCase
    implements IUseCase<GetSecretKeyUsageInputDTO, GetSecretKeyUsageOutputDTO, ApplicationError> {

    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository) private readonly secretKeyRepo: SecretKeyRepository,
        @inject(TEAM_TOKENS.SecretKeyUsageLogRepository) private readonly usageLogRepo: SecretKeyUsageLogRepository,
        @inject(TEAM_TOKENS.SecretKeyUsageMetricsMapper)
        private readonly metricsMapper: ISecretKeyUsageMetricsMapper
    ) {}

    async execute(input: GetSecretKeyUsageInputDTO): Promise<Result<GetSecretKeyUsageOutputDTO, ApplicationError>> {
        const { teamId, secretKeyId } = input;
        const days = input.days !== undefined ? Number(input.days) : 30;

        const populate: SecretKeyRolePopulate = {
            path: 'role',
            select: ['name']
        };

        const secretKey = await this.secretKeyRepo.findById(secretKeyId, { populate });

        if (!secretKey || String(secretKey.props.team) !== teamId) {
            return Result.fail(ApplicationError.notFound(ErrorCodes.SECRET_KEY_NOT_FOUND, 'Secret key not found'));
        }

        const metrics = this.metricsMapper.toKeyMetrics(
            await this.usageLogRepo.getKeyUsageAnalytics(secretKeyId, days)
        );

        return Result.ok({
            key: {
                _id: secretKey._id,
                name: secretKey.props.name,
                keyPrefix: secretKey.props.keyPrefix,
                roleName: secretKey.getRoleName(),
                isActive: secretKey.props.isActive,
                createdAt: secretKey.props.createdAt,
                lastUsedAt: secretKey.props.lastUsedAt || null
            },
            ...metrics
        });
    }
}
