import { InvitationRow } from '../InvitationRow';
import EmptyState from '@/shared/presentation/primitives/EmptyState';
import type { TeamInvitation } from '@/modules/team/api/entities/invitation/team-invitation';
import './InvitationsList.css';

interface InvitationsListProps {
    invitations: TeamInvitation[];
    isLoading: boolean;
    cancelingId: string | null;
    onCancelInvitation: (id: string) => void;
}

export const InvitationsList = ({
    invitations,
    isLoading,
    cancelingId,
    onCancelInvitation
}: InvitationsListProps) => {
    const safeInvitations = Array.isArray(invitations) ? invitations : [];

    if(isLoading) {
        return (
            <div className='invitations-list-loading d-flex items-center content-center'>
                <p className='color-secondary font-size-2 text-center p-1'>
                    Loading invitations...
                </p>
            </div>
        );
    }

    if(safeInvitations.length === 0) {
        return (
            <EmptyState
                title='No Invitations'
                description='No pending invitations'
                className='invitation-list-empty'
            />
        );
    }

    return (
        <div className='invitations-list y-auto f-shrink-0'>
            <div className='d-flex column gap-05'>
                {safeInvitations.map((invitation) => (
                    <InvitationRow
                        key={invitation._id}
                        email={invitation.email}
                        createdAt={invitation.createdAt}
                        onCancel={() => onCancelInvitation(invitation._id)}
                        isLoading={cancelingId === invitation._id}
                    />
                ))}
            </div>
        </div>
    );
};
