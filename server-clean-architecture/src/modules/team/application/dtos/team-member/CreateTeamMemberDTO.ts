import { TeamMemberProps } from '@modules/team/domain/entities/TeamMember';

export interface CreateTeamMemberInputDTO{
    teamId: string;
    userId: string;
    roleId: string;
};

export interface CreateTeamMemberOutputDTO extends TeamMemberProps{}