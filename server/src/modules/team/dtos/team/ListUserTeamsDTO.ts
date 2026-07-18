import { EntityIdInputDTO, EntityOutputDTO } from '@modules/team/dtos/common';
import { TeamProps } from '@modules/team/entities/team/Team';

export type ListUserTeamsInputDTO = EntityIdInputDTO<'userId'>;

export type ListUserTeamsOutputDTO = EntityOutputDTO<TeamProps>;
