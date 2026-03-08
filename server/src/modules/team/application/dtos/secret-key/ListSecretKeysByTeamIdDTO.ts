import {
    PaginatedOutputDTO,
    PaginatedTeamScopedInputDTO
} from '@modules/team/application/dtos/common';

export type ListSecretKeysByTeamIdInputDTO = PaginatedTeamScopedInputDTO;

export interface SecretKeyListItemDTO {
    _id: string;
    teamId: string;
    roleId: string;
    roleName: string;
    name: string;
    keyPrefix: string;
    isActive: boolean;
    lastUsedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export type ListSecretKeysByTeamIdOutputDTO = PaginatedOutputDTO<SecretKeyListItemDTO>;
