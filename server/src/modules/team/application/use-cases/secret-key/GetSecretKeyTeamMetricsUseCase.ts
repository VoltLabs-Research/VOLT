import type SecretKeyUsageLogRepository from '@modules/team/infrastructure/persistence/mongo/repositories/secret-key/SecretKeyUsageLogRepository';
import type SecretKeyRepository from '@modules/team/infrastructure/persistence/mongo/repositories/secret-key/SecretKeyRepository';
import { GetSecretKeyTeamMetricsInputDTO, GetSecretKeyTeamMetricsOutputDTO } from '@modules/team/application/dtos/secret-key/GetSecretKeyTeamMetricsDTO';
import type { ISecretKeyUsageMetricsMapper } from '@modules/team/domain/port/secret-key/ISecretKeyUsageMetricsMapper';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

const MAX_KEYS_PER_TEAM = 500;

interface SecretKeyTeamFilter {
    team: string;
}

interface SecretKeyRolePopulate {
    path: 'role';
    select: ['name'];
}

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
}

@injectable()
export default class GetSecretKeyTeamMetricsUseCase
    implements IUseCase<GetSecretKeyTeamMetricsInputDTO, GetSecretKeyTeamMetricsOutputDTO, ApplicationError> {

    constructor(
        @inject(TEAM_TOKENS.SecretKeyRepository) private readonly secretKeyRepo: SecretKeyRepository,
        @inject(TEAM_TOKENS.SecretKeyUsageLogRepository) private readonly usageLogRepo: SecretKeyUsageLogRepository,
        @inject(TEAM_TOKENS.SecretKeyUsageMetricsMapper)
        private readonly metricsMapper: ISecretKeyUsageMetricsMapper
    ) {}

    async execute(input: GetSecretKeyTeamMetricsInputDTO): Promise<Result<GetSecretKeyTeamMetricsOutputDTO, ApplicationError>> {
        const { teamId, days = 30 } = input;

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
}
