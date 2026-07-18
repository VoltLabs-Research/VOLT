import { TeamScopedEntityIdInputDTO, TeamScopedInputDTO } from '@modules/team/dtos/common';

export type RevokeSecretKeyByIdInputDTO = TeamScopedEntityIdInputDTO<'secretKeyId'>;

export interface RevokeSecretKeyByIdOutputDTO extends TeamScopedInputDTO {
    _id: string;
    isActive: boolean;
    updatedAt: Date;
};
