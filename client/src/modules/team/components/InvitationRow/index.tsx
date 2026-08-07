import { Button, Box, ListRow } from '@voltstack/bravais';
import { getInitialsFromEmail, getAvatarColorFromString } from '@voltstack/bravais';
import { format } from 'date-fns';
import './InvitationRow.css';

interface InvitationRowProps {
    email: string;
    createdAt: Date | string;
    onCancel: () => void;
    isLoading?: boolean;
}

export const InvitationRow = ({
    email,
    createdAt,
    onCancel,
    isLoading = false
}: InvitationRowProps) => {
    return (
        <ListRow
            className='invitation-row'
            leading={
                <Box display='flex' align='center' justify='center' radius='full' shrink='0' className='invitation-avatar font-medium' style={{ backgroundColor: getAvatarColorFromString(email) }}>
                    {getInitialsFromEmail(email)}
                </Box>
            }
            title={email}
            subtitle={`Sent ${format(new Date(createdAt), 'MMM d, h:mm a')}`}
            trailing={
                <Button
                    variant='ghost'
                    size='sm'
                    onClick={onCancel}
                    disabled={isLoading}
                    isLoading={isLoading}
                >
                    Cancel
                </Button>
            }
        />
    );
};
