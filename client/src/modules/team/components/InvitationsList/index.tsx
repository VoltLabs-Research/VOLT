import { InvitationRow } from '../InvitationRow';
import { EmptyState } from '@voltstack/bravais';
import type { TeamInvitation } from '@volt/contracts/modules/team/domain';
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
    if(isLoading) {
        return (
            <div className='flex items-center justify-center invitations-list-loading'>
                <p className='text-sm text-muted text-center p-4'>
                    Loading invitations...
                </p>
            </div>
        );
    }

    if(invitations.length === 0) {
        return (
            <EmptyState
                title='No Invitations'
                description='No pending invitations'
                className='invitation-list-empty'
            />
        );
    }

    return (
        <div className='overflow-y-auto shrink-0 invitations-list'>
            <div className='flex flex-col gap-2'>
                {invitations.map((invitation) => (
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
