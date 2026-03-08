import type { User } from '@/modules/auth/api/entities/user';
import Avatar from '@/shared/presentation/components/Avatar';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { cn } from '@/shared/utils';
import type { ReactNode } from 'react';
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

    return (
        <Container
            className={cn('d-flex items-center gap-075 list-item-hoverable member-list-item', onClick && 'cursor-pointer', className)}
            onClick={onClick}
        >
            <Avatar user={user} size='sm' />
            <Container className='d-flex column flex-1'>
                <Paragraph className='font-size-2-5 font-weight-5 color-primary'>
                    {fullName}
                </Paragraph>
            </Container>
            {role && (
                <Paragraph className={cn('member-list-item-role', role)}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                </Paragraph>
            )}
            {action}
        </Container>
    );
};
