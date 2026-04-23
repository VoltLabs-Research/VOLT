import { ErrorCodes } from '@core/constants/error-codes';
import { GetSecretKeyUsageInputDTO, GetSecretKeyUsageOutputDTO } from '@modules/team/application/dtos/secret-key/GetSecretKeyUsageDTO';
import SecretKeyRepository from '@modules/team/infrastructure/persistence/mongo/repositories/secret-key/SecretKeyRepository';
import SecretKeyUsageLogRepository from '@modules/team/infrastructure/persistence/mongo/repositories/secret-key/SecretKeyUsageLogRepository';
import SecretKeyUsageMetricsMapper from '@modules/team/infrastructure/services/secret-key/SecretKeyUsageMetricsMapper';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

interface SecretKeyRolePopulate {
    path: 'role';
    select: ['name'];
};

@injectable()
export default class GetSecretKeyUsageUseCase
    implements IUseCase<GetSecretKeyUsageInputDTO, GetSecretKeyUsageOutputDTO, ApplicationError> {

    constructor(
        
        private readonly secretKeyRepo: SecretKeyRepository,

        
        private readonly usageLogRepo: SecretKeyUsageLogRepository,

        
        private readonly metricsMapper: SecretKeyUsageMetricsMapper
    ) {}

    async execute(input: GetSecretKeyUsageInputDTO): Promise<Result<GetSecretKeyUsageOutputDTO, ApplicationError>> {
        const { teamId, secretKeyId, days = 30 } = input;

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
};
