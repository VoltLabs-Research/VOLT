import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import SecretKey from '@modules/team/models/SecretKey';
import TeamRole from '@modules/team/models/TeamRole';
import {
    getTeamUsageAnalytics,
    getKeyUsageAnalytics
} from '@modules/team/services/secret-key/SecretKeyUsageAnalyticsQueries';
import SecretKeyUsageMetricsMapper from '@modules/team/services/secret-key/SecretKeyUsageMetricsMapper';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import crypto from 'node:crypto';
import type { CreateSecretKeyInput } from '@volt/contracts/modules/team/http';

const MAX_KEYS_PER_TEAM = 500;
const DEFAULT_SECRET_KEY_LIMIT = 50;
const MAX_SECRET_KEY_LIMIT = 200;
const UNKNOWN_ROLE_NAME = 'Unknown';

interface EnrichedSecretKeyMetric{
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

const roleNameOf = (secretKey: SecretKey): string => secretKey.roleRef?.name ?? UNKNOWN_ROLE_NAME;

export default class SecretKeyService{
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
    }>{
        const { roleId, name } = input;

        const role = await TeamRole.findOneBy({ id: roleId });
        if(!role || role.team !== teamId){
            throw ApplicationError.notFound(ErrorCodes.TEAM_ROLE_NOT_FOUND, 'Team role not found');
        }

        const tokenSuffix = crypto.randomBytes(32).toString('hex');
        const secretKey = `vsk_${tokenSuffix}`;
        const keyPrefix = secretKey.slice(0, 14);
        const keyHash = crypto.createHash('sha256').update(secretKey).digest('hex');

        const created = await SecretKey.create({
            team: teamId,
            role: roleId,
            name,
            keyPrefix,
            keyHash,
            createdBy: userId,
            isActive: true
        }).save();

        await this.#eventBus.emit('secret-key.created', {
            secretKeyId: created.id,
            teamId,
            name: created.name,
            userId
        });

        return {
            secretKeyId: created.id,
            teamId,
            roleId,
            name: created.name,
            keyPrefix: created.keyPrefix,
            secretKey,
            isActive: created.isActive,
            createdAt: created.createdAt
        };
    }

    async current(authType: string | undefined, secretKeyId: string | undefined): Promise<Record<string, unknown>>{
        if(authType !== 'secret-key' || !secretKeyId){
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, 'Secret key authentication required');
        }

        const secretKey = await SecretKey.findOneBy({ id: secretKeyId });
        if(!secretKey){
            throw ApplicationError.notFound(ErrorCodes.SECRET_KEY_INVALID, 'Secret key not found');
        }

        return {
            _id: secretKey.id,
            team: secretKey.team,
            role: secretKey.role,
            createdBy: secretKey.createdBy,
            name: secretKey.name,
            keyPrefix: secretKey.keyPrefix,
            isActive: secretKey.isActive,
            lastUsedAt: secretKey.lastUsedAt,
            createdAt: secretKey.createdAt,
            updatedAt: secretKey.updatedAt
        };
    }

    async listByTeamId(teamId: string, page?: number, limit?: number): Promise<PaginatedResult<Record<string, unknown>>>{
        const pageRequest = readPageRequest(page, limit, {
            defaultLimit: DEFAULT_SECRET_KEY_LIMIT,
            maxLimit: MAX_SECRET_KEY_LIMIT
        });

        const [secretKeys, total] = await SecretKey.findAndCount({
            where: { team: teamId },
            order: { createdAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit,
            relations: {
                roleRef: true,
                createdByRef: true
            }
        });

        const data = secretKeys.map((secretKey) => ({
            _id: secretKey.id,
            teamId: secretKey.team,
            roleId: secretKey.role,
            roleName: roleNameOf(secretKey),
            name: secretKey.name,
            keyPrefix: secretKey.keyPrefix,
            createdBy: secretKey.createdByRef === undefined || secretKey.createdByRef === null
                ? secretKey.createdBy
                : {
                    _id: secretKey.createdByRef.id,
                    firstName: secretKey.createdByRef.firstName,
                    lastName: secretKey.createdByRef.lastName,
                    email: secretKey.createdByRef.email,
                    avatar: secretKey.createdByRef.avatar
                },
            isActive: secretKey.isActive,
            lastUsedAt: secretKey.lastUsedAt,
            createdAt: secretKey.createdAt,
            updatedAt: secretKey.updatedAt
        } as Record<string, unknown>));

        return paginate([data, total], pageRequest);
    }

    async revokeById(teamId: string, secretKeyId: string): Promise<{ _id: string; teamId: string; isActive: boolean; updatedAt: Date }>{
        const key = await SecretKey.findOneBy({ id: secretKeyId });
        if(!key || key.team !== teamId){
            throw ApplicationError.notFound(ErrorCodes.SECRET_KEY_NOT_FOUND, 'Secret key not found');
        }

        const updated = await Object.assign(key, { isActive: false }).save();

        return {
            _id: updated.id,
            teamId,
            isActive: updated.isActive,
            updatedAt: updated.updatedAt
        };
    }

    async deleteById(teamId: string, secretKeyId: string, userId: string): Promise<void>{
        if(!userId){
            throw ApplicationError.badRequest(ErrorCodes.SECRET_KEY_PARAMS_REQUIRED, 'User ID is required');
        }

        const key = await SecretKey.findOneBy({ id: secretKeyId });
        if(!key || key.team !== teamId){
            throw ApplicationError.notFound(ErrorCodes.SECRET_KEY_NOT_FOUND, 'Secret key not found');
        }

        const deletedKeyId = key.id;
        const deletedKeyName = key.name;

        await key.remove();

        await this.#eventBus.emit('secret-key.deleted', {
            secretKeyId: deletedKeyId,
            teamId,
            userId,
            secretKeyName: deletedKeyName ?? ''
        });
    }

    async teamMetrics(teamId: string, days?: number): Promise<Record<string, unknown>>{
        const resolvedDays = days !== undefined ? Number(days) : 30;

        const metrics = this.#metricsMapper.toTeamMetrics(
            await getTeamUsageAnalytics(teamId, resolvedDays)
        );

        const allKeys = await SecretKey.find({
            where: { team: teamId },
            take: MAX_KEYS_PER_TEAM,
            relations: { roleRef: true }
        });

        const totalKeys = allKeys.length;
        const activeKeys = allKeys.filter((key) => key.isActive).length;
        const revokedKeys = totalKeys - activeKeys;

        const usageMap = new Map(metrics.perKey.map((perKey) => [perKey.secretKeyId, perKey]));

        const enrichedPerKey: EnrichedSecretKeyMetric[] = allKeys.map((key) => {
            const usage = usageMap.get(key.id);
            return {
                secretKeyId: key.id,
                name: key.name,
                keyPrefix: key.keyPrefix,
                roleName: roleNameOf(key),
                isActive: key.isActive,
                totalRequests: usage?.totalRequests || 0,
                successRequests: usage?.successRequests || 0,
                avgResponseTime: usage?.avgResponseTime || 0,
                lastRequestAt: usage?.lastRequestAt || key.lastUsedAt || null
            };
        });

        enrichedPerKey.sort((first, second) => second.totalRequests - first.totalRequests);

        return {
            ...metrics,
            totalKeys,
            activeKeys,
            revokedKeys,
            perKey: enrichedPerKey
        };
    }

    async keyUsage(teamId: string, secretKeyId: string, days?: number): Promise<Record<string, unknown>>{
        const resolvedDays = days !== undefined ? Number(days) : 30;

        const secretKey = await SecretKey.findOne({
            where: { id: secretKeyId },
            relations: { roleRef: true }
        });
        if(!secretKey || secretKey.team !== teamId){
            throw ApplicationError.notFound(ErrorCodes.SECRET_KEY_NOT_FOUND, 'Secret key not found');
        }

        const metrics = this.#metricsMapper.toKeyMetrics(
            await getKeyUsageAnalytics(secretKeyId, resolvedDays)
        );

        return {
            key: {
                _id: secretKey.id,
                name: secretKey.name,
                keyPrefix: secretKey.keyPrefix,
                roleName: roleNameOf(secretKey),
                isActive: secretKey.isActive,
                createdAt: secretKey.createdAt,
                lastUsedAt: secretKey.lastUsedAt || null
            },
            ...metrics
        };
    }
}
