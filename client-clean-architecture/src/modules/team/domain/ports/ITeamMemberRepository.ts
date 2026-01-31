import { TeamMember } from '../entities';

export interface UpdateTeamMemberParams{
    role?: string;
};

export default interface ITeamMemberRepository{
    getAll(teamId: string): Promise<TeamMember[]>;
    update(teamId: string, memberId: string, data: UpdateTeamMemberParams): Promise<TeamMember>;
    remove(teamId: string, userId: string): Promise<void>;
};
