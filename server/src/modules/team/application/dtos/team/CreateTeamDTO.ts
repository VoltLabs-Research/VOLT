import { EntityIdInputDTO } from '@modules/team/application/dtos/common';
import { TeamProps } from '@modules/team/domain/entities/team/Team';

export interface CreateTeamInputDTO extends EntityIdInputDTO<'userId'> {
    name: string;
    description: string;
};

export interface CreateTeamOutputDTO extends TeamProps {
    _id: string;
};
