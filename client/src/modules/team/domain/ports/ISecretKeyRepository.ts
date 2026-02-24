import { PaginatedResponse } from '@/shared/domain/pagination';
import { SecretKey } from '../entities';

export interface GetSecretKeysParams {
    page?: number;
    limit?: number;
    sort?: string;
}

export interface CreateSecretKeyParams {
    name: string;
    roleId: string;
}

export interface CreateSecretKeyResponse {
    secretKeyId: string;
    teamId: string;
    roleId: string;
    name: string;
    keyPrefix: string;
    secretKey: string;
    isActive: boolean;
    createdAt: Date | string;
}

export default interface ISecretKeyRepository {
    listByTeamId(teamId: string, params: GetSecretKeysParams): Promise<PaginatedResponse<SecretKey>>;
    create(teamId: string, data: CreateSecretKeyParams): Promise<CreateSecretKeyResponse>;
    revokeById(teamId: string, secretKeyId: string): Promise<void>;
}
