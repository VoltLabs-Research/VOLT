import secretKeyService from '../../api/services/secret-key';
import { createInvalidatingMutation, createQueryResource } from '@/shared/api/query-resources';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SecretKey } from '../../api/entities/secret-key/secret-key';
import type { TeamUsageMetrics, KeyUsageMetrics } from '../../api/entities/secret-key/secret-key-metrics';
import type { CreateSecretKeyInputDTO, CreateSecretKeyResponse } from '../../api/dtos/secret-key/create-secret-key';
import type { DeleteSecretKeyInputDTO } from '../../api/dtos/secret-key/delete-secret-key';
import type { RevokeSecretKeyInputDTO } from '../../api/dtos/secret-key/revoke-secret-key';

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

const secretKeysResource = createQueryResource<SecretKeysQueryParams, string, PaginatedResponse<SecretKey>>({
    baseKey: 'secret-keys',
    rootKey: 'secretKeys',
    itemKey: 'secretKeysListing',
    getKeyParam: ({ teamId }) => teamId,
    query: secretKeyService.listByTeamId
});

const secretKeyUsageResource = createQueryResource<SecretKeyUsageQueryParams, SecretKeyUsageKeyParams, KeyUsageMetrics>({
    baseKey: 'secret-key-usage',
    rootKey: 'secretKeyUsage',
    itemKey: 'secretKeyUsageByParams',
    getKeyParam: ({ teamId, secretKeyId, days }) => ({ teamId, secretKeyId, days }),
    query: secretKeyService.getKeyUsage
});

const secretKeyTeamMetricsResource = createQueryResource<
    SecretKeyTeamMetricsQueryParams,
    SecretKeyTeamMetricsKeyParams,
    TeamUsageMetrics
>({
    baseKey: 'secret-key-team-metrics',
    rootKey: 'secretKeyTeamMetrics',
    itemKey: 'secretKeyTeamMetricsByParams',
    getKeyParam: ({ teamId, days }) => ({ teamId, days }),
    query: secretKeyService.getTeamMetrics
});

export const SECRET_KEY_QUERY_KEYS = {
    secretKeys: secretKeysResource.keys.root,
    secretKeysListing: secretKeysResource.keys.item,
    secretKeyUsage: secretKeyUsageResource.keys.root,
    secretKeyTeamMetrics: secretKeyTeamMetricsResource.keys.root
};

const invalidateSecretKeysQuery = secretKeysResource.invalidate;

export const useSecretKeysQuery = secretKeysResource.query;

export const buildSecretKeysQueryOptions = secretKeysResource.query.buildOptions;

export const fetchSecretKeys = secretKeysResource.query.fetch;

export const useSecretKeyUsageQuery = secretKeyUsageResource.query;

export const useSecretKeyTeamMetricsQuery = secretKeyTeamMetricsResource.query;

export const useCreateSecretKeyMutation = createInvalidatingMutation<CreateSecretKeyResponse, CreateSecretKeyInputDTO>({
    mutationFn: secretKeyService.create,
    onSuccess: (_data, variables) => {
        void invalidateSecretKeysQuery(variables.teamId);
    }
});

export const useDeleteSecretKeyMutation = createInvalidatingMutation<void, DeleteSecretKeyInputDTO>({
    mutationFn: secretKeyService.deleteById,
    onSuccess: (_data, variables) => {
        void invalidateSecretKeysQuery(variables.teamId);
    }
});

export const useRevokeSecretKeyMutation = createInvalidatingMutation<void, RevokeSecretKeyInputDTO>({
    mutationFn: secretKeyService.revokeById,
    onSuccess: (_data, variables) => {
        void invalidateSecretKeysQuery(variables.teamId);
    }
});
