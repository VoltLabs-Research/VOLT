import type { TeamInvitation } from '../entities';

export interface ITeamInvitationRepository {
    getDetails(invitationId: string): Promise<TeamInvitation>;
    getPending(): Promise<TeamInvitation[]>;
    send(email: string, role?: string): Promise<void>;
    cancel(invitationId: string): Promise<void>;
    accept(invitationId: string): Promise<void>;
    reject(invitationId: string): Promise<void>;
}
