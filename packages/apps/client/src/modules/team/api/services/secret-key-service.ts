import { createService, paginated, serviceRoutes } from '@/app/core/http/utils/create-service';
import { secretKeyRoutes } from '@volt/contracts/modules/team/routes';

import type { PaginatedResponse } from '@voltstack/voltclient';
import type { SecretKey } from '@volt/contracts/modules/team/domain';
import type { TeamUsageMetrics, KeyUsageMetrics } from '@volt/contracts/modules/team/domain';
import type { CreateSecretKeyResponse } from '@volt/contracts/modules/team/domain';
import type { PageParams, TeamScopedParams } from '@/shared/api/request-params';
import type { CreateSecretKeyInput } from '@volt/contracts/modules/team/http';

export type CreateSecretKeyParams = TeamScopedParams & CreateSecretKeyInput;

export interface DeleteSecretKeyInput extends TeamScopedParams {
    secretKeyId: string;
}

export interface GetSecretKeyTeamMetricsInput extends TeamScopedParams {
    days?: number;
}

export interface GetSecretKeyUsageInput extends DeleteSecretKeyInput {
    days?: number;
}

interface GetSecretKeysInput extends TeamScopedParams, PageParams {
    sort?: string;
}

const routes = serviceRoutes('/teams');

const endpoints = {
    listByTeamId: paginated<GetSecretKeysInput, PaginatedResponse<SecretKey>>(routes.path(secretKeyRoutes.list)),
    create: routes.route<CreateSecretKeyParams, CreateSecretKeyResponse>(secretKeyRoutes.create),
    revokeById: routes.route<DeleteSecretKeyInput, void>(
        secretKeyRoutes.revokeById, { unwrap: 'void' }
    ),
    deleteById: routes.route<DeleteSecretKeyInput, void>(secretKeyRoutes.deleteById, { unwrap: 'void' }),
    getTeamMetrics: routes.route<GetSecretKeyTeamMetricsInput, TeamUsageMetrics>(
        secretKeyRoutes.teamMetrics
    ),
    getKeyUsage: routes.route<GetSecretKeyUsageInput, KeyUsageMetrics>(
        secretKeyRoutes.keyUsage
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, endpoints);
