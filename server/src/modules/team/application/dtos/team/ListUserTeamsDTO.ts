import {
    EntityIdInputDTO,
    EntityPropsOutputDTO
} from '@modules/team/application/dtos/common';
import { TeamProps } from '@modules/team/domain/entities/Team';

export type ListUserTeamsInputDTO = EntityIdInputDTO<'userId'>;

export type ListUserTeamsOutputDTO = EntityPropsOutputDTO<TeamProps>;
