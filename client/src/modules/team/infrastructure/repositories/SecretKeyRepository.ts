import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type ISecretKeyRepository from '../../domain/ports/ISecretKeyRepository';
import type { GetSecretKeysParams, CreateSecretKeyParams, CreateSecretKeyResponse } from '../../domain/ports/ISecretKeyRepository';
import type { SecretKey, TeamUsageMetrics, KeyUsageMetrics } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

@injectable()
export default class SecretKeyRepository extends BaseRepository implements ISecretKeyRepository {
    constructor() {
        super('/team/secret-keys', { useRBAC: false });
    }

    async listByTeamId(teamId: string, params: GetSecretKeysParams): Promise<PaginatedResponse<SecretKey>> {
        return this.getAllPaginated(`/${teamId}`, params);
    }

    async create(teamId: string, data: CreateSecretKeyParams): Promise<CreateSecretKeyResponse> {
        const response = await this.client.post<ApiResponse<CreateSecretKeyResponse>>(`/${teamId}`, data);
        return this.unwrap(response);
    }

    async revokeById(teamId: string, secretKeyId: string): Promise<void> {
        await this.client.patch(`/${teamId}/${secretKeyId}/revoke`, {});
    }

    async deleteById(teamId: string, secretKeyId: string): Promise<void> {
        await this.client.delete(`/${teamId}/${secretKeyId}`);
    }

    async getTeamMetrics(teamId: string, params?: { days?: number }): Promise<TeamUsageMetrics> {
        const response = await this.client.get<ApiResponse<TeamUsageMetrics>>(`/${teamId}/metrics`, params as Record<string, unknown>);
        return this.unwrap(response);
    }

    async getKeyUsage(teamId: string, secretKeyId: string, params?: { days?: number }): Promise<KeyUsageMetrics> {
        const response = await this.client.get<ApiResponse<KeyUsageMetrics>>(`/${teamId}/${secretKeyId}/usage`, params as Record<string, unknown>);
        return this.unwrap(response);
    }
}
