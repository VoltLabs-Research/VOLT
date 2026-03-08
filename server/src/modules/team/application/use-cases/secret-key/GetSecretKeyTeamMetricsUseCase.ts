import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/application/di/TeamTokens';
import { ISecretKeyRepository } from '@modules/team/domain/port/ISecretKeyRepository';
import { ISecretKeyUsageLogRepository } from '@modules/team/domain/port/ISecretKeyUsageLogRepository';
import SecretKeyUsageMetricsMapper from '@modules/team/application/services/SecretKeyUsageMetricsMapper';
import {
    GetSecretKeyTeamMetricsInputDTO,
    GetSecretKeyTeamMetricsOutputDTO,
    getSecretKeyTeamMetricsInputSchema
} from '@modules/team/application/dtos/secret-key/GetSecretKeyTeamMetricsDTO';
import { resolveSecretKeyValidationErrorCode } from '@modules/team/application/use-cases/secret-key/resolve-secret-key-validation-error-code';

const MAX_KEYS_PER_TEAM = 500;

@injectable()
export default class GetSecretKeyTeamMetricsUseCase
    implements IUseCase<GetSecretKeyTeamMetricsInputDTO, GetSecretKeyTeamMetricsOutputDTO, ApplicationError> {

    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository)
        private readonly secretKeyRepo: ISecretKeyRepository,

        @inject(TEAM_TOKENS.SecretKeyUsageLogRepository)
        private readonly usageLogRepo: ISecretKeyUsageLogRepository,

        @inject(TEAM_TOKENS.SecretKeyUsageMetricsMapper)
        private readonly metricsMapper: SecretKeyUsageMetricsMapper
    ) {}

    async execute(input: GetSecretKeyTeamMetricsInputDTO): Promise<Result<GetSecretKeyTeamMetricsOutputDTO, ApplicationError>> {
        const parsed = getSecretKeyTeamMetricsInputSchema.safeParse(input);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0];
            return Result.fail(ApplicationError.badRequest(
                resolveSecretKeyValidationErrorCode(firstError.message),
                firstError.message
            ));
        }

        const { teamId, days = 30 } = parsed.data;

        if (!teamId) {
            return Result.fail(ApplicationError.badRequest(ErrorCodes.TEAM_ID_REQUIRED, 'Team ID is required'));
        }

        const metrics = this.metricsMapper.toTeamMetrics(
            await this.usageLogRepo.getTeamUsageAnalytics(teamId, days)
        );

        const keysResult = await this.secretKeyRepo.findAll({
            filter: { team: teamId },
            limit: MAX_KEYS_PER_TEAM,
            populate: { path: 'role', select: ['name'] }
        });

        const allKeys = keysResult.data;
        const totalKeys = allKeys.length;
        const activeKeys = allKeys.filter(k => k.props.isActive).length;
        const revokedKeys = totalKeys - activeKeys;

        const usageMap = new Map(metrics.perKey.map(pk => [pk.secretKeyId, pk]));

        const enrichedPerKey = allKeys.map(key => {
            const usage = usageMap.get(key._id);
            return {
                secretKeyId: key._id,
                name: key.props.name,
                keyPrefix: key.props.keyPrefix,
                roleName: key.getRoleName(),
                isActive: key.props.isActive,
                totalRequests: usage?.totalRequests || 0,
                successRequests: usage?.successRequests || 0,
                avgResponseTime: usage?.avgResponseTime || 0,
                lastRequestAt: usage?.lastRequestAt || key.props.lastUsedAt || null
            };
        });

        enrichedPerKey.sort((a, b) => b.totalRequests - a.totalRequests);

        return Result.ok({
            ...metrics,
            totalKeys,
            activeKeys,
            revokedKeys,
            perKey: enrichedPerKey
        });
    }
}
