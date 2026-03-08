import { get } from '@/app/core/http/utilities/create-service';
import type { TeamUsageMetrics, KeyUsageMetrics } from '@/modules/team/api/entities/secret-key/secret-key-metrics';
import type { GetSecretKeyTeamMetricsInputDTO } from '../../../dtos/secret-key/get-secret-key-team-metrics';
import type { GetSecretKeyUsageInputDTO } from '../../../dtos/secret-key/get-secret-key-usage';

export default {
    getTeamMetrics: get<GetSecretKeyTeamMetricsInputDTO, TeamUsageMetrics>(
        '/:teamId/secret-keys/metrics'
    ),
    getKeyUsage: get<GetSecretKeyUsageInputDTO, KeyUsageMetrics>(
        '/:teamId/secret-keys/:secretKeyId/usage'
    )
};
