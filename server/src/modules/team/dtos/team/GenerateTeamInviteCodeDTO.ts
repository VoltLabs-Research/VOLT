import { TeamUserScopedInputDTO, EntityOutputDTO } from '@modules/team/dtos/common';
import type { TeamProps } from '@modules/team/entities/team/Team';

export type GenerateTeamInviteCodeInputDTO = TeamUserScopedInputDTO;

export type GenerateTeamInviteCodeOutputDTO = EntityOutputDTO<TeamProps>;
