import secretKeyService from '../../api/services/secret-key-service';
import { buildKeys, createInvalidatingMutation, createQuery } from '@/shared/query';
import type {
    CreateSecretKeyParams,
    DeleteSecretKeyInput,
    GetSecretKeyTeamMetricsInput,
    GetSecretKeyUsageInput
} from '../../api/services/secret-key-service';
import type { CreateSecretKeyResponse } from '@volt/contracts/modules/team/domain';
import type { KeyUsageMetrics, TeamUsageMetrics } from '@volt/contracts/modules/team/domain';

const secretKeyKeys = buildKeys<{
    secretKeysListing: string;
}>('secret-keys');

const secretKeyUsageKeys = buildKeys<{
    secretKeyUsageByParams: GetSecretKeyUsageInput;
}>('secret-key-usage');

const secretKeyTeamMetricsKeys = buildKeys<{
    secretKeyTeamMetricsByParams: GetSecretKeyTeamMetricsInput;
}>('secret-key-team-metrics');

export const SECRET_KEY_QUERY_KEYS = {
    secretKeysListing: secretKeyKeys.secretKeysListing,
    secretKeyUsageByParams: secretKeyUsageKeys.secretKeyUsageByParams,
    secretKeyTeamMetricsByParams: secretKeyTeamMetricsKeys.secretKeyTeamMetricsByParams
};

export const useSecretKeyUsageQuery = createQuery<GetSecretKeyUsageInput, KeyUsageMetrics>(
    SECRET_KEY_QUERY_KEYS.secretKeyUsageByParams,
    secretKeyService.getKeyUsage
);

export const useSecretKeyTeamMetricsQuery = createQuery<GetSecretKeyTeamMetricsInput, TeamUsageMetrics>(
    SECRET_KEY_QUERY_KEYS.secretKeyTeamMetricsByParams,
    secretKeyService.getTeamMetrics
);

export const useCreateSecretKeyMutation = createInvalidatingMutation<CreateSecretKeyResponse, CreateSecretKeyParams>(
    secretKeyService.create,
    (_data, variables) => [SECRET_KEY_QUERY_KEYS.secretKeysListing(variables.teamId)]
);

export const useDeleteSecretKeyMutation = createInvalidatingMutation<void, DeleteSecretKeyInput>(
    secretKeyService.deleteById,
    (_data, variables) => [SECRET_KEY_QUERY_KEYS.secretKeysListing(variables.teamId)]
);

export const useRevokeSecretKeyMutation = createInvalidatingMutation<void, DeleteSecretKeyInput>(
    secretKeyService.revokeById,
    (_data, variables) => [SECRET_KEY_QUERY_KEYS.secretKeysListing(variables.teamId)]
);
