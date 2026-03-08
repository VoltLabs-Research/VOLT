import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import queryClient from '@/shared/infrastructure/query/query-client';
import { buildKeys } from '@/shared/infrastructure/query';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SecretKey } from '../../api/entities/secret-key';
import type { TeamUsageMetrics, KeyUsageMetrics } from '../../api/entities/secret-key-metrics';
import type { CreateSecretKeyInputDTO, CreateSecretKeyResponse } from '../../api/dtos/create-secret-key';
import type { DeleteSecretKeyInputDTO } from '../../api/dtos/delete-secret-key';
import type { RevokeSecretKeyInputDTO } from '../../api/dtos/revoke-secret-key';
import secretKeyService from '../../api/services/secret-key';

type QueryOptions<TQueryFnData, TData = TQueryFnData> = Partial<UseQueryOptions<TQueryFnData, Error, TData>>;

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

const secretKeyKeys = buildKeys<{
    secretKeys: void;
    secretKeysListing: string;
}>('secret-keys');

const secretKeyUsageKeys = buildKeys<{
    secretKeyUsage: void;
    secretKeyUsageByParams: { teamId: string; secretKeyId: string; days?: number };
}>('secret-key-usage');

const secretKeyMetricsKeys = buildKeys<{
    secretKeyTeamMetrics: void;
    secretKeyTeamMetricsByParams: { teamId: string; days?: number };
}>('secret-key-team-metrics');

export const SECRET_KEY_QUERY_KEYS = {
    secretKeys: secretKeyKeys.secretKeys,
    secretKeysListing: secretKeyKeys.secretKeysListing,
    secretKeyUsage: secretKeyUsageKeys.secretKeyUsage,
    secretKeyTeamMetrics: secretKeyMetricsKeys.secretKeyTeamMetrics
};

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

const invalidateSecretKeysQuery = (teamId: string) => {
    return queryClient.invalidateQueries({ queryKey: SECRET_KEY_QUERY_KEYS.secretKeysListing(teamId) });
};

// ---------------------------------------------------------------------------
// Query param interfaces
// ---------------------------------------------------------------------------

interface SecretKeysQueryParams {
    teamId: string;
    page?: number;
    limit?: number;
    sort?: string;
}

interface SecretKeyUsageQueryParams {
    teamId: string;
    secretKeyId: string;
    days?: number;
}

interface SecretKeyTeamMetricsQueryParams {
    teamId: string;
    days?: number;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export const useSecretKeysQuery = (
    params: SecretKeysQueryParams,
    options?: QueryOptions<PaginatedResponse<SecretKey>>
) => {
    return useQuery({
        queryKey: SECRET_KEY_QUERY_KEYS.secretKeysListing(params.teamId),
        queryFn: () => secretKeyService.listByTeamId({ teamId: params.teamId, page: params.page, limit: params.limit, sort: params.sort }),
        ...options
    });
};

export const buildSecretKeysQueryOptions = (params: SecretKeysQueryParams) => ({
    queryKey: SECRET_KEY_QUERY_KEYS.secretKeysListing(params.teamId),
    queryFn: () => secretKeyService.listByTeamId({ teamId: params.teamId, page: params.page, limit: params.limit, sort: params.sort })
});

export const fetchSecretKeys = (params: SecretKeysQueryParams) => {
    return queryClient.fetchQuery(buildSecretKeysQueryOptions(params));
};

export const useSecretKeyUsageQuery = (
    params: SecretKeyUsageQueryParams,
    options?: QueryOptions<KeyUsageMetrics>
) => {
    return useQuery({
        queryKey: secretKeyUsageKeys.secretKeyUsageByParams(params),
        queryFn: () => secretKeyService.getKeyUsage({
            teamId: params.teamId,
            secretKeyId: params.secretKeyId,
            days: params.days
        }),
        ...options
    });
};

export const useSecretKeyTeamMetricsQuery = (
    params: SecretKeyTeamMetricsQueryParams,
    options?: QueryOptions<TeamUsageMetrics>
) => {
    return useQuery({
        queryKey: secretKeyMetricsKeys.secretKeyTeamMetricsByParams(params),
        queryFn: () => secretKeyService.getTeamMetrics({ teamId: params.teamId, days: params.days }),
        ...options
    });
};

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export const useCreateSecretKeyMutation = () => {
    return useMutation<CreateSecretKeyResponse, Error, CreateSecretKeyInputDTO>({
        mutationFn: secretKeyService.create,
        onSuccess: (_data, variables) => {
            void invalidateSecretKeysQuery(variables.teamId);
        }
    });
};

export const useDeleteSecretKeyMutation = () => {
    return useMutation<void, Error, DeleteSecretKeyInputDTO>({
        mutationFn: secretKeyService.deleteById,
        onSuccess: (_data, variables) => {
            void invalidateSecretKeysQuery(variables.teamId);
        }
    });
};

export const useRevokeSecretKeyMutation = () => {
    return useMutation<void, Error, RevokeSecretKeyInputDTO>({
        mutationFn: secretKeyService.revokeById,
        onSuccess: (_data, variables) => {
            void invalidateSecretKeysQuery(variables.teamId);
        }
    });
};
