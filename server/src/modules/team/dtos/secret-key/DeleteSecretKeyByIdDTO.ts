import { EntityIdInputDTO, TeamUserScopedInputDTO } from '@modules/team/dtos/common';

export type DeleteSecretKeyByIdInputDTO = TeamUserScopedInputDTO & EntityIdInputDTO<'secretKeyId'>;
