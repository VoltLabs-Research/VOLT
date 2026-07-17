import { createService, get, paginated, post, patch, del } from '@/app/core/http/utilities/create-service';

import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { SecretKey } from '@/modules/team/api/types/secret-key/secret-key';
import type { TeamUsageMetrics, KeyUsageMetrics } from '@/modules/team/api/types/secret-key/secret-key-metrics';

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

export interface CreateSecretKeyInput {
    teamId: string;
    name: string;
    roleId: string;
}

export interface DeleteSecretKeyInput {
    teamId: string;
    secretKeyId: string;
}

export interface GetSecretKeyTeamMetricsInput {
    teamId: string;
    days?: number;
}

export interface GetSecretKeyUsageInput {
    teamId: string;
    secretKeyId: string;
    days?: number;
}

export interface GetSecretKeysInput {
    teamId: string;
    page?: number;
    limit?: number;
    sort?: string;
}

export type RevokeSecretKeyInput = DeleteSecretKeyInput;

const endpoints = {
    listByTeamId: paginated<GetSecretKeysInput, PaginatedResponse<SecretKey>>('/:teamId/secret-keys'),
    create: post<CreateSecretKeyInput, CreateSecretKeyResponse>('/:teamId/secret-keys'),
    revokeById: patch<RevokeSecretKeyInput, void>(
        '/:teamId/secret-keys/:secretKeyId', { unwrap: 'void' }
    ),
    deleteById: del<DeleteSecretKeyInput>('/:teamId/secret-keys/:secretKeyId'),
    getTeamMetrics: get<GetSecretKeyTeamMetricsInput, TeamUsageMetrics>(
        '/:teamId/secret-keys/metrics'
    ),
    getKeyUsage: get<GetSecretKeyUsageInput, KeyUsageMetrics>(
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
