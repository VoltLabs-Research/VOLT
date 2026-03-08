import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
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
        <Container className='invitation-row list-item-hoverable radius-sm d-flex items-center content-between gap-075'>
            <Container className='d-flex items-center gap-075 flex-1'>
                <Container
                    className='invitation-avatar radius-full d-flex items-center content-center f-shrink-0 font-weight-5'
                    style={{ backgroundColor: getAvatarColorFromString(email) }}
                >
                    {getInitialsFromEmail(email)}
                </Container>
                <Container className='flex-1 overflow-hidden'>
                    <Paragraph className='font-weight-5 overflow-hidden text-ellipsis'>
                        {email}
                    </Paragraph>
                    <Paragraph className='font-size-1 color-secondary'>
                        Sent {format(new Date(createdAt), 'MMM d, h:mm a')}
                    </Paragraph>
                </Container>
            </Container>
            <Button
                variant='ghost'
                size='sm'
                onClick={onCancel}
                disabled={isLoading}
                isLoading={isLoading}
            >
                Cancel
            </Button>
        </Container>
    );
};
