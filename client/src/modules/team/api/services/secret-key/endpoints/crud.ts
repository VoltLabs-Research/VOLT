import { paginated, post, patch, del } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { SecretKey } from '@/modules/team/api/entities/secret-key';
import type { GetSecretKeysInputDTO } from '../../../dtos/get-secret-keys';
import type { CreateSecretKeyInputDTO, CreateSecretKeyResponse } from '../../../dtos/create-secret-key';
import type { RevokeSecretKeyInputDTO } from '../../../dtos/revoke-secret-key';
import type { DeleteSecretKeyInputDTO } from '../../../dtos/delete-secret-key';

const endpoints = {
    listByTeamId: paginated<GetSecretKeysInputDTO, PaginatedResponse<SecretKey>>('/:teamId/secret-keys'),
    create: post<CreateSecretKeyInputDTO, CreateSecretKeyResponse>('/:teamId/secret-keys'),
    revokeById: patch<RevokeSecretKeyInputDTO, void>(
        '/:teamId/secret-keys/:secretKeyId', { unwrap: 'void' }
    ),
    deleteById: del<DeleteSecretKeyInputDTO>('/:teamId/secret-keys/:secretKeyId')
};

export default endpoints;
