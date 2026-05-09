import secretKeyService from '../../api/services/secret-key-service';
import { buildKeys, createInvalidatingMutation, createQuery } from '@/shared/infrastructure/query';
import type { CreateSecretKeyInputDTO, CreateSecretKeyResponse, DeleteSecretKeyInputDTO, RevokeSecretKeyInputDTO } from '../../api/services/secret-key-service';
import type { KeyUsageMetrics, TeamUsageMetrics } from '../../api/entities/secret-key/secret-key-metrics';

interface SecretKeyUsageQueryParams {
    teamId: string;
    secretKeyId: string;
    days?: number;
}

interface SecretKeyTeamMetricsQueryParams {
    teamId: string;
    days?: number;
}

interface SecretKeyUsageKeyParams {
    teamId: string;
    secretKeyId: string;
    days?: number;
}

interface SecretKeyTeamMetricsKeyParams {
    teamId: string;
    days?: number;
}

interface SecretKeyQueryKeyMap {
    secretKeysListing: string;
}

interface SecretKeyUsageQueryKeyMap {
    secretKeyUsageByParams: SecretKeyUsageKeyParams;
}

interface SecretKeyTeamMetricsQueryKeyMap {
    secretKeyTeamMetricsByParams: SecretKeyTeamMetricsKeyParams;
}

const secretKeyKeys = buildKeys<SecretKeyQueryKeyMap>('secret-keys');

const secretKeyUsageKeys = buildKeys<SecretKeyUsageQueryKeyMap>('secret-key-usage');

const secretKeyTeamMetricsKeys = buildKeys<SecretKeyTeamMetricsQueryKeyMap>('secret-key-team-metrics');

export const SECRET_KEY_QUERY_KEYS = {
    secretKeysListing: secretKeyKeys.secretKeysListing,
    secretKeyUsageByParams: secretKeyUsageKeys.secretKeyUsageByParams,
    secretKeyTeamMetricsByParams: secretKeyTeamMetricsKeys.secretKeyTeamMetricsByParams
};

const getSecretKeyUsageQueryKey = (params: SecretKeyUsageQueryParams) => {
    return SECRET_KEY_QUERY_KEYS.secretKeyUsageByParams({
        teamId: params.teamId,
        secretKeyId: params.secretKeyId,
        days: params.days
    });
};

const getSecretKeyTeamMetricsQueryKey = (params: SecretKeyTeamMetricsQueryParams) => {
    return SECRET_KEY_QUERY_KEYS.secretKeyTeamMetricsByParams({
        teamId: params.teamId,
        days: params.days
    });
};

export const useSecretKeyUsageQuery = createQuery<SecretKeyUsageQueryParams, KeyUsageMetrics>(
    getSecretKeyUsageQueryKey,
    secretKeyService.getKeyUsage
);

export const useSecretKeyTeamMetricsQuery = createQuery<SecretKeyTeamMetricsQueryParams, TeamUsageMetrics>(
    getSecretKeyTeamMetricsQueryKey,
    secretKeyService.getTeamMetrics
);

export const useCreateSecretKeyMutation = createInvalidatingMutation<CreateSecretKeyResponse, CreateSecretKeyInputDTO>(
    secretKeyService.create,
    (_data, variables) => [SECRET_KEY_QUERY_KEYS.secretKeysListing(variables.teamId)]
);

export const useDeleteSecretKeyMutation = createInvalidatingMutation<void, DeleteSecretKeyInputDTO>(
    secretKeyService.deleteById,
    (_data, variables) => [SECRET_KEY_QUERY_KEYS.secretKeysListing(variables.teamId)]
);

export const useRevokeSecretKeyMutation = createInvalidatingMutation<void, RevokeSecretKeyInputDTO>(
    secretKeyService.revokeById,
    (_data, variables) => [SECRET_KEY_QUERY_KEYS.secretKeysListing(variables.teamId)]
);
