import { TeamScopedEntityIdInputDTO, TeamScopedInputDTO } from '@modules/team/application/dtos/common';

export type RevokeSecretKeyByIdInputDTO = TeamScopedEntityIdInputDTO<'secretKeyId'>;

export interface RevokeSecretKeyByIdOutputDTO extends TeamScopedInputDTO {
    _id: string;
    isActive: boolean;
    updatedAt: Date;
};
