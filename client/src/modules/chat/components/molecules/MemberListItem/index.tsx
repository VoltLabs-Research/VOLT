import type { ReactNode } from 'react';
import Avatar from '@/shared/presentation/components/Avatar';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { cn } from '@/shared/utils';
import type { User } from '@/modules/auth/api/entities/user';
import './MemberListItem.css';

type MemberRole = 'owner' | 'admin' | 'member';

interface MemberListItemProps {
    user: User;
    role?: MemberRole;
    action?: ReactNode;
    onClick?: () => void;
    className?: string;
};

export const MemberListItem = ({ user, role, action, onClick, className }: MemberListItemProps) => {
    const fullName = `${user.firstName} ${user.lastName}`;
    const content = (
        <>
            <Avatar user={user} size='sm' />
            <Container className='d-flex column flex-1'>
                <Paragraph className='font-size-3 font-weight-5 color-primary'>
                    {fullName}
                </Paragraph>
            </Container>
            {role && (
                <Paragraph className={cn('member-list-item-role font-size-2', role)}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                </Paragraph>
            )}
            {action}
        </>
    );

    if (onClick) {
        return (
            <button
                type='button'
                className={cn('d-flex items-center gap-075 list-item-hoverable member-list-item member-list-item-button', className)}
                onClick={onClick}
            >
                {content}
            </button>
        );
    }

    return (
        <Container
            className={cn('d-flex items-center gap-075 list-item-hoverable member-list-item', className)}
        >
            {content}
        </Container>
    );
};

export default MemberListItem;
