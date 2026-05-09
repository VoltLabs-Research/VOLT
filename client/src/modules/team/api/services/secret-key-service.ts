import { createService, get, paginated, post, patch, del } from '@/app/core/http/utilities/create-service';

import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { SecretKey } from '@/modules/team/api/entities/secret-key/secret-key';
import type { TeamUsageMetrics, KeyUsageMetrics } from '@/modules/team/api/entities/secret-key/secret-key-metrics';

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

export interface CreateSecretKeyInputDTO {
    teamId: string;
    name: string;
    roleId: string;
}

export interface DeleteSecretKeyInputDTO {
    teamId: string;
    secretKeyId: string;
}

export interface GetSecretKeyTeamMetricsInputDTO {
    teamId: string;
    days?: number;
}

export interface GetSecretKeyUsageInputDTO {
    teamId: string;
    secretKeyId: string;
    days?: number;
}

export interface GetSecretKeysInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    sort?: string;
}

export type RevokeSecretKeyInputDTO = DeleteSecretKeyInputDTO;

const endpoints = {
    listByTeamId: paginated<GetSecretKeysInputDTO, PaginatedResponse<SecretKey>>('/:teamId/secret-keys'),
    create: post<CreateSecretKeyInputDTO, CreateSecretKeyResponse>('/:teamId/secret-keys'),
    revokeById: patch<RevokeSecretKeyInputDTO, void>(
        '/:teamId/secret-keys/:secretKeyId', { unwrap: 'void' }
    ),
    deleteById: del<DeleteSecretKeyInputDTO>('/:teamId/secret-keys/:secretKeyId'),
    getTeamMetrics: get<GetSecretKeyTeamMetricsInputDTO, TeamUsageMetrics>(
        '/:teamId/secret-keys/metrics'
    ),
    getKeyUsage: get<GetSecretKeyUsageInputDTO, KeyUsageMetrics>(
        '/:teamId/secret-keys/:secretKeyId/usage'
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, endpoints);
