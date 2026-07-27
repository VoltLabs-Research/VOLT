import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import TeamRoleModel from '@modules/team/models/team-role/TeamRoleModel';
import SecretKeyModel, {
    getSecretKeyCreatedById,
    getSecretKeyRoleId,
    getSecretKeyRoleName
} from '@modules/team/models/secret-key/SecretKeyModel';
import {
    getTeamUsageAnalytics,
    getKeyUsageAnalytics
} from '@modules/team/services/secret-key/SecretKeyUsageAnalyticsQueries';
import SecretKeyUsageMetricsMapper from '@modules/team/services/secret-key/SecretKeyUsageMetricsMapper';
import SecretKeyCreatedEvent from '@modules/team/events/secret-key/SecretKeyCreatedEvent';
import SecretKeyDeletedEvent from '@modules/team/events/secret-key/SecretKeyDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import { ROLE_POPULATE, USER_POPULATE } from '@shared/infrastructure/persistence/mongo/PopulatePresets';
import crypto from 'node:crypto';
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

export default class SecretKeyService {
    #metricsMapper = new SecretKeyUsageMetricsMapper();
    #eventBus = eventBus;

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

        const role = await TeamRoleModel.findById(roleId);
        if (!role || String(role.team) !== teamId) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Team role not found');
        }

        const tokenSuffix = crypto.randomBytes(32).toString('hex');
        const secretKey = `vsk_${tokenSuffix}`;
        const keyPrefix = secretKey.slice(0, 14);
        const keyHash = crypto.createHash('sha256').update(secretKey).digest('hex');

        const created = await SecretKeyModel.create({
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
            secretKeyId: String(created._id),
            teamId,
            name: created.name,
            userId
        }));

        return {
            secretKeyId: String(created._id),
            teamId,
            roleId,
            name: created.name,
            keyPrefix: created.keyPrefix,
            secretKey,
            isActive: created.isActive,
            createdAt: created.createdAt
        };
    }

    async current(authType: string | undefined, secretKeyId: string | undefined): Promise<Record<string, unknown>> {
        if (authType !== 'secret-key' || !secretKeyId) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, 'Secret key authentication required');
        }

        const secretKey = await SecretKeyModel.findById(secretKeyId);
        if (!secretKey) {
            throw ApplicationError.notFound(ErrorCodes.SECRET_KEY_INVALID, 'Secret key not found');
        }

        return {
            _id: String(secretKey._id),
            team: String(secretKey.team),
            role: getSecretKeyRoleId(secretKey),
            createdBy: getSecretKeyCreatedById(secretKey),
            name: secretKey.name,
            keyPrefix: secretKey.keyPrefix,
            isActive: secretKey.isActive,
            lastUsedAt: secretKey.lastUsedAt,
            createdAt: secretKey.createdAt,
            updatedAt: secretKey.updatedAt
        };
    }

    async listByTeamId(teamId: string, page?: number, limit?: number): Promise<PaginatedResult<Record<string, unknown>>> {
        const resolvedPage = Math.max(1, page ?? 1);
        const resolvedLimit = Math.max(1, Math.min(200, limit ?? 50));
        const filter = { team: teamId };
        const skip = (resolvedPage - 1) * resolvedLimit;

        const [docs, total] = await Promise.all([
            SecretKeyModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(resolvedLimit)
                .populate([ROLE_POPULATE, USER_POPULATE]),
            SecretKeyModel.countDocuments(filter)
        ]);

        const data = docs.map((secretKey) => ({
            _id: String(secretKey._id),
            teamId: String(secretKey.team),
            roleId: getSecretKeyRoleId(secretKey),
            roleName: getSecretKeyRoleName(secretKey),
            name: secretKey.name,
            keyPrefix: secretKey.keyPrefix,
            createdBy: secretKey.createdBy,
            isActive: secretKey.isActive,
            lastUsedAt: secretKey.lastUsedAt,
            createdAt: secretKey.createdAt,
            updatedAt: secretKey.updatedAt
        } as unknown as Record<string, unknown>));

        return {
            data,
            total,
            page: resolvedPage,
            totalPages: Math.ceil(total / resolvedLimit),
            limit: resolvedLimit
        };
    }

    async revokeById(teamId: string, secretKeyId: string): Promise<{ _id: string; teamId: string; isActive: boolean; updatedAt: Date }> {
        const key = await SecretKeyModel.findById(secretKeyId);
        if (!key || String(key.team) !== teamId) {
            throw ApplicationError.notFound(ErrorCodes.SECRET_KEY_NOT_FOUND, 'Secret key not found');
        }

        const updated = await SecretKeyModel.findByIdAndUpdate(
            key._id,
            { isActive: false, updatedAt: new Date() },
            { new: true }
        );
        if (!updated) {
            throw ApplicationError.notFound(ErrorCodes.SECRET_KEY_NOT_FOUND, 'Secret key not found');
        }

        return {
            _id: String(updated._id),
            teamId,
            isActive: updated.isActive,
            updatedAt: updated.updatedAt
        };
    }

    async deleteById(teamId: string, secretKeyId: string, userId: string): Promise<void> {
        if (!userId) {
            throw ApplicationError.badRequest(ErrorCodes.SECRET_KEY_PARAMS_REQUIRED, 'User ID is required');
        }

        const key = await SecretKeyModel.findById(secretKeyId);
        if (!key || String(key.team) !== teamId) {
            throw ApplicationError.notFound(ErrorCodes.SECRET_KEY_NOT_FOUND, 'Secret key not found');
        }

        await SecretKeyModel.findByIdAndDelete(key._id);

        await this.#eventBus.publish(new SecretKeyDeletedEvent({
            secretKeyId: String(key._id),
            teamId,
            userId,
            secretKeyName: key.name ?? ''
        }));
    }

    async teamMetrics(teamId: string, days?: number): Promise<Record<string, unknown>> {
        const resolvedDays = days !== undefined ? Number(days) : 30;

        const metrics = this.#metricsMapper.toTeamMetrics(
            await getTeamUsageAnalytics(teamId, resolvedDays)
        );

        const allKeys = await SecretKeyModel.find({ team: teamId })
            .limit(MAX_KEYS_PER_TEAM)
            .populate({ path: 'role', select: ['name'] });

        const totalKeys = allKeys.length;
        const activeKeys = allKeys.filter((k) => k.isActive).length;
        const revokedKeys = totalKeys - activeKeys;

        const usageMap = new Map(metrics.perKey.map((pk) => [pk.secretKeyId, pk]));

        const enrichedPerKey: EnrichedSecretKeyMetric[] = allKeys.map((key) => {
            const keyId = String(key._id);
            const usage = usageMap.get(keyId);
            return {
                secretKeyId: keyId,
                name: key.name,
                keyPrefix: key.keyPrefix,
                roleName: getSecretKeyRoleName(key),
                isActive: key.isActive,
                totalRequests: usage?.totalRequests || 0,
                successRequests: usage?.successRequests || 0,
                avgResponseTime: usage?.avgResponseTime || 0,
                lastRequestAt: usage?.lastRequestAt || key.lastUsedAt || null
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

        const secretKey = await SecretKeyModel.findById(secretKeyId).populate({ path: 'role', select: ['name'] });
        if (!secretKey || String(secretKey.team) !== teamId) {
            throw ApplicationError.notFound(ErrorCodes.SECRET_KEY_NOT_FOUND, 'Secret key not found');
        }

        const metrics = this.#metricsMapper.toKeyMetrics(
            await getKeyUsageAnalytics(secretKeyId, resolvedDays)
        );

        return {
            key: {
                _id: String(secretKey._id),
                name: secretKey.name,
                keyPrefix: secretKey.keyPrefix,
                roleName: getSecretKeyRoleName(secretKey),
                isActive: secretKey.isActive,
                createdAt: secretKey.createdAt,
                lastUsedAt: secretKey.lastUsedAt || null
            },
            ...metrics
        };
    }
}
