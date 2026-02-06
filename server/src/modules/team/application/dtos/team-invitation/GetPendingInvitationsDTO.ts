import { PaginatedResult } from '@shared/domain/ports/IBaseRepository';
import { TeamInvitationProps } from '@modules/team/domain/entities/TeamInvitation';

export interface GetPendingInvitationsInputDTO {
    teamId: string;
}

export interface GetPendingInvitationsOutputDTO extends PaginatedResult<TeamInvitationProps>{}