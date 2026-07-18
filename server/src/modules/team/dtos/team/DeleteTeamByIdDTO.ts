import { EntityIdInputDTO } from '@modules/team/dtos/common';

export type DeleteTeamByIdInputDTO = EntityIdInputDTO<'teamId'> & {
    userId?: string;
};
