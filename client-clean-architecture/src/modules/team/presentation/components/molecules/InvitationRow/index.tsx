import React from 'react';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import { formatShortDate } from '@/shared/utils/format';
import { getInitialsFromEmail, getAvatarColorFromString } from '@/shared/utils/user';
import './InvitationRow.css';

interface InvitationRowProps {
    email: string;
    createdAt: Date | string;
    onCancel: () => void;
    isLoading?: boolean;
};

const InvitationRow: React.FC<InvitationRowProps> = ({
    email,
    createdAt,
    onCancel,
    isLoading = false
}) => {
    return (
        <Container className='invitation-row radius-sm d-flex items-center content-between gap-075'>
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
                        Sent {formatShortDate(createdAt)}
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

export default InvitationRow;
