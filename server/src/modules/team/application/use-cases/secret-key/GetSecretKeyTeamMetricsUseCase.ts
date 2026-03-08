import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { GetSecretKeyTeamMetricsInputDTO, GetSecretKeyTeamMetricsOutputDTO, getSecretKeyTeamMetricsInputSchema } from '@modules/team/application/dtos/secret-key/GetSecretKeyTeamMetricsDTO';
import SecretKeyUsageMetricsMapper from '@modules/team/application/services/secret-key/SecretKeyUsageMetricsMapper';
import { resolveSecretKeyValidationErrorCode } from '@modules/team/application/use-cases/secret-key/resolve-secret-key-validation-error-code';
import { ISecretKeyRepository } from '@modules/team/domain/port/secret-key/ISecretKeyRepository';
import { ISecretKeyUsageLogRepository } from '@modules/team/domain/port/secret-key/ISecretKeyUsageLogRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

const MAX_KEYS_PER_TEAM = 500;

interface SecretKeyTeamFilter {
    team: string;
};

interface SecretKeyRolePopulate {
    path: 'role';
    select: ['name'];
};

interface EnrichedSecretKeyMetric {
    secretKeyId: string;
    name: string;
    keyPrefix: string;
    roleName: string;
    isActive: boolean;
    totalRequests: number;
    successRequests: number;
    avgResponseTime: number;
    lastRequestAt: Date | null;
};

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
        const filter: SecretKeyTeamFilter = { team: teamId };
        const populate: SecretKeyRolePopulate = {
            path: 'role',
            select: ['name']
        };

        const keysResult = await this.secretKeyRepo.findAll({
            filter,
            limit: MAX_KEYS_PER_TEAM,
            populate
        });

        const allKeys = keysResult.data;
        const totalKeys = allKeys.length;
        const activeKeys = allKeys.filter(k => k.props.isActive).length;
        const revokedKeys = totalKeys - activeKeys;

        const usageMap = new Map(metrics.perKey.map(pk => [pk.secretKeyId, pk]));

        const toEnrichedSecretKeyMetric = (key: typeof allKeys[number]): EnrichedSecretKeyMetric => {
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
        };

        const enrichedPerKey = allKeys.map(toEnrichedSecretKeyMetric);

        enrichedPerKey.sort((a, b) => b.totalRequests - a.totalRequests);

        return Result.ok({
            ...metrics,
            totalKeys,
            activeKeys,
            revokedKeys,
            perKey: enrichedPerKey
        });
    }
};
