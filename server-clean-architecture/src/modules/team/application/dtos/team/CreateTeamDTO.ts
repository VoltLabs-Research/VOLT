import { TeamProps } from '@modules/team/domain/entities/Team';

export interface CreateTeamInputDTO {
    name: string;
    description: string;
    ownerId: string;
};

export interface CreateTeamOutputDTO extends TeamProps {
    _id: string;
}