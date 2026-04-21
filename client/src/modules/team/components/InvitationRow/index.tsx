import Button from '@/shared/presentation/components/Button';
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
        <div className='volt-container invitation-row list-item-hoverable radius-sm d-flex items-center content-between gap-075'>
            <div className='volt-container d-flex items-center gap-075 flex-1'>
                <div className='volt-container invitation-avatar radius-full d-flex items-center content-center f-shrink-0 font-weight-5' style={{ backgroundColor: getAvatarColorFromString(email) }}>
                    {getInitialsFromEmail(email)}
                </div>
                <div className='volt-container flex-1 overflow-hidden'>
                    <p className='volt-text font-weight-5 overflow-hidden text-ellipsis'>
                        {email}
                    </p>
                    <p className='volt-text font-size-1 color-secondary'>
                        Sent {format(new Date(createdAt), 'MMM d, h:mm a')}
                    </p>
                </div>
            </div>
            <Button
                variant='ghost'
                size='sm'
                onClick={onCancel}
                disabled={isLoading}
                isLoading={isLoading}
            >
                Cancel
            </Button>
        </div>
    );
};
