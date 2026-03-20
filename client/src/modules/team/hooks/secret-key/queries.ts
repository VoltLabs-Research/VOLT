import secretKeyService from '../../api/services/secret-key';
import { buildKeys, createMutation, createQuery, queryClient } from '@/shared/infrastructure/query';
import type { CreateSecretKeyInputDTO, CreateSecretKeyResponse } from '../../api/dtos/secret-key/create-secret-key';
import type { DeleteSecretKeyInputDTO } from '../../api/dtos/secret-key/delete-secret-key';
import type { RevokeSecretKeyInputDTO } from '../../api/dtos/secret-key/revoke-secret-key';
import type { SecretKey } from '../../api/entities/secret-key/secret-key';
import type { KeyUsageMetrics, TeamUsageMetrics } from '../../api/entities/secret-key/secret-key-metrics';
import type { PaginatedResponse } from '@/shared/domain/pagination';

interface SecretKeysQueryParams {
    teamId: string;
    page?: number;
    limit?: number;
    sort?: string;
};

interface SecretKeyUsageQueryParams {
    teamId: string;
    secretKeyId: string;
    days?: number;
};

interface SecretKeyTeamMetricsQueryParams {
    teamId: string;
    days?: number;
};

interface SecretKeyUsageKeyParams {
    teamId: string;
    secretKeyId: string;
    days?: number;
};

interface SecretKeyTeamMetricsKeyParams {
    teamId: string;
    days?: number;
};

interface SecretKeyQueryKeyMap {
    secretKeysListing: string;
};

interface SecretKeyUsageQueryKeyMap {
    secretKeyUsageByParams: SecretKeyUsageKeyParams;
};

interface SecretKeyTeamMetricsQueryKeyMap {
    secretKeyTeamMetricsByParams: SecretKeyTeamMetricsKeyParams;
};

const secretKeyKeys = buildKeys<SecretKeyQueryKeyMap>('secret-keys');

const secretKeyUsageKeys = buildKeys<SecretKeyUsageQueryKeyMap>('secret-key-usage');

const secretKeyTeamMetricsKeys = buildKeys<SecretKeyTeamMetricsQueryKeyMap>('secret-key-team-metrics');

export const SECRET_KEY_QUERY_KEYS = {
    secretKeysListing: secretKeyKeys.secretKeysListing,
    secretKeyUsageByParams: secretKeyUsageKeys.secretKeyUsageByParams,
    secretKeyTeamMetricsByParams: secretKeyTeamMetricsKeys.secretKeyTeamMetricsByParams
};

const getSecretKeysQueryKey = (params: SecretKeysQueryParams) => {
    return SECRET_KEY_QUERY_KEYS.secretKeysListing(params.teamId);
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

const invalidateSecretKeysQuery = (teamId: string) => {
    return queryClient.invalidateQueries({
        queryKey: SECRET_KEY_QUERY_KEYS.secretKeysListing(teamId)
    });
};

export const useSecretKeysQuery = createQuery<SecretKeysQueryParams, PaginatedResponse<SecretKey>>(
    getSecretKeysQueryKey,
    secretKeyService.listByTeamId
);

export const useSecretKeyUsageQuery = createQuery<SecretKeyUsageQueryParams, KeyUsageMetrics>(
    getSecretKeyUsageQueryKey,
    secretKeyService.getKeyUsage
);

export const useSecretKeyTeamMetricsQuery = createQuery<SecretKeyTeamMetricsQueryParams, TeamUsageMetrics>(
    getSecretKeyTeamMetricsQueryKey,
    secretKeyService.getTeamMetrics
);

export const useCreateSecretKeyMutation = createMutation<CreateSecretKeyResponse, CreateSecretKeyInputDTO>(
    secretKeyService.create,
    async (_data, variables) => {
        await invalidateSecretKeysQuery(variables.teamId);
    }
);

export const useDeleteSecretKeyMutation = createMutation<void, DeleteSecretKeyInputDTO>(
    secretKeyService.deleteById,
    async (_data, variables) => {
        await invalidateSecretKeysQuery(variables.teamId);
    }
);

export const useRevokeSecretKeyMutation = createMutation<void, RevokeSecretKeyInputDTO>(
    secretKeyService.revokeById,
    async (_data, variables) => {
        await invalidateSecretKeysQuery(variables.teamId);
    }
);
