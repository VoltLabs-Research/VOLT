import React from 'react';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import InvitationRow from '../InvitationRow';
import EmptyState from '@/shared/presentation/components/EmptyState';
import type { TeamInvitation } from '@/modules/team/domain/entities/TeamInvitation';
import './InvitationsList.css';

interface InvitationsListProps {
    invitations: TeamInvitation[];
    isLoading: boolean;
    cancelingId: string | null;
    onCancelInvitation: (id: string) => void;
};

const InvitationsList: React.FC<InvitationsListProps> = ({
    invitations,
    isLoading,
    cancelingId,
    onCancelInvitation
}) => {
    if(isLoading) {
        return (
            <Container className='invitations-list-loading'>
                <Paragraph className='color-secondary font-size-2 text-center p-1'>
                    Loading invitations...
                </Paragraph>
            </Container>
        );
    }

    if(invitations.length === 0) {
        return (
            <EmptyState
                title='No Invitations'
                description='No pending invitations'
            />
        );
    }

    return (
        <Container className='invitations-list y-auto f-shrink-0'>
            <Container className='d-flex column gap-05'>
                {invitations.map((invitation) => (
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

export default InvitationsList;
