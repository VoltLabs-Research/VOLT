import { PaginatedOutputDTO, PaginatedTeamScopedInputDTO } from '@modules/team/dtos/common';
import type { SecretKeyProps } from '@modules/team/entities/secret-key/SecretKey';

export type ListSecretKeysByTeamIdInputDTO = PaginatedTeamScopedInputDTO;

export interface SecretKeyListItemDTO {
    _id: string;
    teamId: string;
    roleId: string;
    roleName: string;
    name: string;
    keyPrefix: string;
    createdBy: SecretKeyProps['createdBy'];
    isActive: boolean;
    lastUsedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
};

export type ListSecretKeysByTeamIdOutputDTO = PaginatedOutputDTO<SecretKeyListItemDTO>;
