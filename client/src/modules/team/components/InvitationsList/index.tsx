import { InvitationRow } from '../InvitationRow';
import Box from '@/shared/presentation/primitives/Box';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
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
            <Box display='flex' align='center' justify='center' className='invitations-list-loading'>
                <Text as='p' tone='secondary' size='md' align='center' className='p-1'>
                    Loading invitations...
                </Text>
            </Box>
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
        <Box overflow='y-auto' shrink='0' className='invitations-list'>
            <Stack gap='05'>
                {safeInvitations.map((invitation) => (
                    <InvitationRow
                        key={invitation._id}
                        email={invitation.email}
                        createdAt={invitation.createdAt}
                        onCancel={() => onCancelInvitation(invitation._id)}
                        isLoading={cancelingId === invitation._id}
                    />
                ))}
            </Stack>
        </Box>
    );
};
