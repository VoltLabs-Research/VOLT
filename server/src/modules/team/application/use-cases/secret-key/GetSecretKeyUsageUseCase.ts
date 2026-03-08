import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import { ISecretKeyRepository } from '@modules/team/domain/port/ISecretKeyRepository';
import { ISecretKeyUsageLogRepository } from '@modules/team/domain/port/ISecretKeyUsageLogRepository';
import SecretKeyUsageMetricsMapper from '@modules/team/application/services/SecretKeyUsageMetricsMapper';
import { ErrorCodes } from '@core/constants/error-codes';
import {
    GetSecretKeyUsageInputDTO,
    GetSecretKeyUsageOutputDTO,
    getSecretKeyUsageInputSchema
} from '@modules/team/application/dtos/secret-key/GetSecretKeyUsageDTO';
import { resolveSecretKeyValidationErrorCode } from '@modules/team/application/use-cases/secret-key/resolve-secret-key-validation-error-code';

@injectable()
export default class GetSecretKeyUsageUseCase
    implements IUseCase<GetSecretKeyUsageInputDTO, GetSecretKeyUsageOutputDTO, ApplicationError> {

    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository)
        private readonly secretKeyRepo: ISecretKeyRepository,

        @inject(TEAM_TOKENS.SecretKeyUsageLogRepository)
        private readonly usageLogRepo: ISecretKeyUsageLogRepository,

        @inject(TEAM_TOKENS.SecretKeyUsageMetricsMapper)
        private readonly metricsMapper: SecretKeyUsageMetricsMapper
    ) {}

    async execute(input: GetSecretKeyUsageInputDTO): Promise<Result<GetSecretKeyUsageOutputDTO, ApplicationError>> {
        const parsed = getSecretKeyUsageInputSchema.safeParse(input);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0];
            return Result.fail(ApplicationError.badRequest(
                resolveSecretKeyValidationErrorCode(firstError.message),
                firstError.message
            ));
        }

        const { teamId, secretKeyId, days = 30 } = parsed.data;

        if (!teamId || !secretKeyId) {
            return Result.fail(ApplicationError.badRequest(ErrorCodes.SECRET_KEY_PARAMS_REQUIRED, 'Team ID and Secret Key ID are required'));
        }

        const secretKey = await this.secretKeyRepo.findById(secretKeyId, {
            populate: { path: 'role', select: ['name'] }
        });

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
