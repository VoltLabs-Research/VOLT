import { InvitationRow } from '../InvitationRow';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Paragraph from '@/shared/presentation/components/Paragraph';
import type { TeamInvitation } from '@/modules/team/api/entities/invitation/team-invitation';
import './InvitationsList.css';

interface InvitationsListProps {
    invitations: TeamInvitation[];
    isLoading: boolean;
    cancelingId: string | null;
    onCancelInvitation: (id: string) => void;
};

export const InvitationsList = ({
    invitations,
    isLoading,
    cancelingId,
    onCancelInvitation
}: InvitationsListProps) => {
    const safeInvitations = Array.isArray(invitations) ? invitations : [];

    if(isLoading) {
        return (
            <Container className='invitations-list-loading d-flex items-center content-center'>
                <Paragraph className='color-secondary font-size-2 text-center p-1'>
                    Loading invitations...
                </Paragraph>
            </Container>
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
        <Container className='invitations-list y-auto f-shrink-0'>
            <Container className='d-flex column gap-05'>
                {safeInvitations.map((invitation) => (
                    <InvitationRow
                        key={invitation._id}
                        email={invitation.email}
                        createdAt={invitation.createdAt}
                        onCancel={() => onCancelInvitation(invitation._id)}
                        isLoading={cancelingId === invitation._id}
                    />
                ))}
            </Container>
        </Container>
    );
};
