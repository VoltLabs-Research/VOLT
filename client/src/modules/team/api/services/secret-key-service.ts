import { get, paginated, post, patch, del } from '@/app/core/http/utilities/create-service';
import { defineServiceModule } from '@/shared/api/service-module';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SecretKey } from '@/modules/team/api/entities/secret-key/secret-key';
import type { TeamUsageMetrics, KeyUsageMetrics } from '@/modules/team/api/entities/secret-key/secret-key-metrics';
import type { GetSecretKeysInputDTO } from '../dtos/secret-key/get-secret-keys';
import type { CreateSecretKeyInputDTO, CreateSecretKeyResponse } from '../dtos/secret-key/create-secret-key';
import type { RevokeSecretKeyInputDTO } from '../dtos/secret-key/revoke-secret-key';
import type { DeleteSecretKeyInputDTO } from '../dtos/secret-key/delete-secret-key';
import type { GetSecretKeyTeamMetricsInputDTO } from '../dtos/secret-key/get-secret-key-team-metrics';
import type { GetSecretKeyUsageInputDTO } from '../dtos/secret-key/get-secret-key-usage';

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

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/teams'
        }
    },
    endpoints
});
