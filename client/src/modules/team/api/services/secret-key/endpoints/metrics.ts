import { get } from '@/app/core/http/utilities/create-service';
import type { TeamUsageMetrics, KeyUsageMetrics } from '@/modules/team/api/entities/secret-key-metrics';
import type { GetSecretKeyTeamMetricsInputDTO } from '../../../dtos/get-secret-key-team-metrics';
import type { GetSecretKeyUsageInputDTO } from '../../../dtos/get-secret-key-usage';

const endpoints = {
    getTeamMetrics: get<GetSecretKeyTeamMetricsInputDTO, TeamUsageMetrics>(
        '/:teamId/secret-keys/metrics'
    ),
    getKeyUsage: get<GetSecretKeyUsageInputDTO, KeyUsageMetrics>(
        '/:teamId/secret-keys/:secretKeyId/usage'
    )
};

export default endpoints;
