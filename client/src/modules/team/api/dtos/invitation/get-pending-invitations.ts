import type { TeamInvitation } from '../../entities/invitation';

export interface GetPendingInvitationsInputDTO {
    teamId: string;
};

export type GetPendingInvitationsOutputDTO = TeamInvitation[];
