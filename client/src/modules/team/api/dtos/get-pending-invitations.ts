import type { TeamInvitation } from '../entities/team-invitation';

export interface GetPendingInvitationsInputDTO {
    teamId: string;
};

export type GetPendingInvitationsOutputDTO = TeamInvitation[];
