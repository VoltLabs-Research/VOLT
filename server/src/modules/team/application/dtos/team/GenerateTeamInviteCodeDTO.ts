import { TeamUserScopedInputDTO, EntityOutputDTO } from '@modules/team/application/dtos/common';
import type { TeamProps } from '@modules/team/domain/entities/team/Team';

export type GenerateTeamInviteCodeInputDTO = TeamUserScopedInputDTO;

export type GenerateTeamInviteCodeOutputDTO = EntityOutputDTO<TeamProps>;
