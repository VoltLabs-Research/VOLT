import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { ISecretKeyRepository } from '@modules/team/ports/secret-key/ISecretKeyRepository';
import type { ISecretKeyUsageLogRepository } from '@modules/team/ports/secret-key/ISecretKeyUsageLogRepository';
import type { ISecretKeyUsageMetricsMapper } from '@modules/team/ports/secret-key/ISecretKeyUsageMetricsMapper';
import type { ITeamRoleRepository } from '@modules/team/ports/team-role/ITeamRoleRepository';
import SecretKeyCreatedEvent from '@modules/team/events/secret-key/SecretKeyCreatedEvent';
import SecretKeyDeletedEvent from '@modules/team/events/secret-key/SecretKeyDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { ROLE_POPULATE, USER_POPULATE } from '@shared/infrastructure/persistence/mongo/PopulatePresets';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import crypto from 'node:crypto';
import { container as diContainer } from 'tsyringe';
import type { CreateSecretKeyInput } from '@volt/contracts/modules/team/http';

const MAX_KEYS_PER_TEAM = 500;

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

/**
 * The single application service for the secret-key resource. Folds the former
 * create/current/list/revoke/delete/team-metrics/key-usage use-cases. The
 * secret-key repository and its usage-log repository are shared singletons — the
 * `protect` authentication middleware resolves both to validate keys and record
 * per-request usage — so this service resolves them once from the DI container,
 * alongside the metrics mapper (aggregation → chart series) and role repository.
 */
export default class SecretKeyService {
    #keys = diContainer.resolve<ISecretKeyRepository>(TEAM_TOKENS.SecretKeyRepository);
    #usageLog = diContainer.resolve<ISecretKeyUsageLogRepository>(TEAM_TOKENS.SecretKeyUsageLogRepository);
    #metricsMapper = diContainer.resolve<ISecretKeyUsageMetricsMapper>(TEAM_TOKENS.SecretKeyUsageMetricsMapper);
    #roles = diContainer.resolve<ITeamRoleRepository>(TEAM_TOKENS.TeamRoleRepository);
    #eventBus = diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    async create(teamId: string, userId: string, input: CreateSecretKeyInput): Promise<{
        secretKeyId: string;
        teamId: string;
        roleId: string;
        name: string;
        keyPrefix: string;
        secretKey: string;
        isActive: boolean;
        createdAt: Date;
    }> {
        const { roleId, name } = input;

        const role = await this.#roles.findById(roleId);
        if (!role || role.props.team !== teamId) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Team role not found');
        }

        const tokenSuffix = crypto.randomBytes(32).toString('hex');
        const secretKey = `vsk_${tokenSuffix}`;
        const keyPrefix = secretKey.slice(0, 14);
        const keyHash = crypto.createHash('sha256').update(secretKey).digest('hex');

        const created = await this.#keys.create({
            team: teamId,
            role: roleId,
            name,
            keyPrefix,
            keyHash,
            createdBy: userId,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await this.#eventBus.publish(new SecretKeyCreatedEvent({
            secretKeyId: created._id,
            teamId,
            name: created.props.name,
            userId
        }));

        return {
            secretKeyId: created._id,
            teamId,
            roleId,
            name: created.props.name,
            keyPrefix: created.props.keyPrefix,
            secretKey,
            isActive: created.props.isActive,
            createdAt: created.props.createdAt
        };
    }

    async current(authType: string | undefined, secretKeyId: string | undefined): Promise<Record<string, unknown>> {
        if (authType !== 'secret-key' || !secretKeyId) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, 'Secret key authentication required');
        }

        const secretKey = await this.#keys.findById(secretKeyId);
        if (!secretKey) {
            throw ApplicationError.notFound(ErrorCodes.SECRET_KEY_INVALID, 'Secret key not found');
        }

        return {
            _id: secretKey._id,
            team: typeof secretKey.props.team === 'string' ? secretKey.props.team : String(secretKey.props.team),
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

    async listByTeamId(teamId: string, page?: number, limit?: number): Promise<PaginatedResult<Record<string, unknown>>> {
        const resolvedPage = Math.max(1, page ?? 1);
        const resolvedLimit = Math.max(1, Math.min(200, limit ?? 50));

        const result = await this.#keys.findAll({
            filter: { team: teamId },
            page: resolvedPage,
            limit: resolvedLimit,
            sort: { createdAt: -1 },
            populate: [ROLE_POPULATE, USER_POPULATE]
        });

        const data = result.data.map((secretKey) => ({
            _id: secretKey._id,
            teamId: String(secretKey.props.team),
            roleId: secretKey.getRoleId(),
            roleName: secretKey.getRoleName(),
            name: secretKey.props.name,
            keyPrefix: secretKey.props.keyPrefix,
            createdBy: secretKey.props.createdBy,
            isActive: secretKey.props.isActive,
            lastUsedAt: secretKey.props.lastUsedAt,
            createdAt: secretKey.props.createdAt,
            updatedAt: secretKey.props.updatedAt
        } as unknown as Record<string, unknown>));

        return { ...result, data };
    }

    async revokeById(teamId: string, secretKeyId: string): Promise<{ _id: string; teamId: string; isActive: boolean; updatedAt: Date }> {
        const key = await this.#keys.findById(secretKeyId);
        if (!key || key.props.team !== teamId) {
            throw ApplicationError.notFound(ErrorCodes.SECRET_KEY_NOT_FOUND, 'Secret key not found');
        }

        const updated = await this.#keys.updateById(key._id, { isActive: false, updatedAt: new Date() });
        if (!updated) {
            throw ApplicationError.notFound(ErrorCodes.SECRET_KEY_NOT_FOUND, 'Secret key not found');
        }

        return {
            _id: updated._id,
            teamId,
            isActive: updated.props.isActive,
            updatedAt: updated.props.updatedAt
        };
    }

    async deleteById(teamId: string, secretKeyId: string, userId: string): Promise<void> {
        if (!userId) {
            throw ApplicationError.badRequest(ErrorCodes.SECRET_KEY_PARAMS_REQUIRED, 'User ID is required');
        }

        const key = await this.#keys.findById(secretKeyId);
        if (!key || key.props.team !== teamId) {
            throw ApplicationError.notFound(ErrorCodes.SECRET_KEY_NOT_FOUND, 'Secret key not found');
        }

        await this.#keys.deleteById(key._id);

        await this.#eventBus.publish(new SecretKeyDeletedEvent({
            secretKeyId: key._id,
            teamId,
            userId,
            secretKeyName: key.props.name ?? ''
        }));
    }

    async teamMetrics(teamId: string, days?: number): Promise<Record<string, unknown>> {
        const resolvedDays = days !== undefined ? Number(days) : 30;

        const metrics = this.#metricsMapper.toTeamMetrics(
            await this.#usageLog.getTeamUsageAnalytics(teamId, resolvedDays)
        );

        const keysResult = await this.#keys.findAll({
            filter: { team: teamId },
            limit: MAX_KEYS_PER_TEAM,
            populate: { path: 'role', select: ['name'] }
        });

        const allKeys = keysResult.data;
        const totalKeys = allKeys.length;
        const activeKeys = allKeys.filter((k) => k.props.isActive).length;
        const revokedKeys = totalKeys - activeKeys;

        const usageMap = new Map(metrics.perKey.map((pk) => [pk.secretKeyId, pk]));

        const enrichedPerKey: EnrichedSecretKeyMetric[] = allKeys.map((key) => {
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

        return {
            ...metrics,
            totalKeys,
            activeKeys,
            revokedKeys,
            perKey: enrichedPerKey
        };
    }

    async keyUsage(teamId: string, secretKeyId: string, days?: number): Promise<Record<string, unknown>> {
        const resolvedDays = days !== undefined ? Number(days) : 30;

        const secretKey = await this.#keys.findById(secretKeyId, { populate: { path: 'role', select: ['name'] } });
        if (!secretKey || String(secretKey.props.team) !== teamId) {
            throw ApplicationError.notFound(ErrorCodes.SECRET_KEY_NOT_FOUND, 'Secret key not found');
        }

        const metrics = this.#metricsMapper.toKeyMetrics(
            await this.#usageLog.getKeyUsageAnalytics(secretKeyId, resolvedDays)
        );

        return {
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
        };
    }
}
