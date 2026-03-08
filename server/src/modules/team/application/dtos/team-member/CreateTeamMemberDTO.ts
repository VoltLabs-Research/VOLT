import { PersistedEntityDTO } from '@modules/team/application/dtos/common';
import { TeamMemberProps } from '@modules/team/domain/entities/team-member/TeamMember';

export interface CreateTeamMemberInputDTO{
    teamId: string;
    userId: string;
    roleId: string;
};

export type CreateTeamMemberOutputDTO = PersistedEntityDTO<TeamMemberProps>;
