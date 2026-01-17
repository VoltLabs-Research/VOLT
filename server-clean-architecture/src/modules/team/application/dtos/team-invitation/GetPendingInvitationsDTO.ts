import { PaginatedResult } from '@/src/shared/domain/ports/IBaseRepository';
import { TeamInvitationProps } from '../../../domain/entities/TeamInvitation';

export interface GetPendingInvitationsInputDTO {
    teamId: string;
}

export interface GetPendingInvitationsOutputDTO extends PaginatedResult<TeamInvitationProps>{}