import type { Team } from '@/modules/team/api/entities/team/team';

export interface GenerateInviteCodeInputDTO {
    teamId: string;
};

export type GenerateInviteCodeOutputDTO = Team;
