import React from 'react';
import { format } from 'date-fns';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
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
    const getInitials = (email: string) => {
        return email.split('@')[0].charAt(0).toUpperCase();
    };

    const getAvatarColor = (email: string) => {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
        const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    };

    return (
        <Container className='invitation-row radius-sm d-flex items-center content-between gap-075'>
            <Container className='d-flex items-center gap-075 flex-1'>
                <Container
                    className='invitation-avatar radius-full d-flex items-center content-center f-shrink-0 font-weight-5'
                    style={{ backgroundColor: getAvatarColor(email) }}
                >
                    {getInitials(email)}
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

export default InvitationRow;
