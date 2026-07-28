import { createService, get, paginated, post, patch, del } from '@/app/core/http/utils/create-service';

import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { SecretKey } from '@volt/contracts/modules/team/domain';
import type { TeamUsageMetrics, KeyUsageMetrics } from '@volt/contracts/modules/team/domain';
import type { CreateSecretKeyResponse } from '@volt/contracts/modules/team/domain';
import type { TeamScopedParams } from '@/shared/api/request-params';
import type { CreateSecretKeyInput } from '@volt/contracts/modules/team/http';

export type CreateSecretKeyParams = TeamScopedParams & CreateSecretKeyInput;

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
    create: post<CreateSecretKeyParams, CreateSecretKeyResponse>('/:teamId/secret-keys'),
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
