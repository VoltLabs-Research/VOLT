import Button from '@/shared/presentation/primitives/Button';
import ListRow from '@/shared/presentation/primitives/ListRow';
import { getInitialsFromEmail, getAvatarColorFromString } from '@/shared/utils/user';
import { format } from 'date-fns';
import './InvitationRow.css';

interface InvitationRowProps {
    email: string;
    createdAt: Date | string;
    onCancel: () => void;
    isLoading?: boolean;
};

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
                <div className='invitation-avatar radius-full d-flex items-center content-center f-shrink-0 font-weight-5' style={{ backgroundColor: getAvatarColorFromString(email) }}>
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
