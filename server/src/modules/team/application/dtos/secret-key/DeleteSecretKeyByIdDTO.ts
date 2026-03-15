import { EntityIdInputDTO, TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';

export type DeleteSecretKeyByIdInputDTO = TeamUserScopedInputDTO & EntityIdInputDTO<'secretKeyId'>;
