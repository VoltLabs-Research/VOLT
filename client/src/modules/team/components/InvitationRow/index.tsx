import { Button, ListRow } from '@voltstack/bravais';
import { getAvatarColorFromString, getInitialsFromEmail } from '@/shared/utils/user';
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
                <div className='flex items-center justify-center rounded-full shrink-0 invitation-avatar font-medium' style={{ backgroundColor: getAvatarColorFromString(email) }}>
                    {getInitialsFromEmail(email)}
                </div>
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
