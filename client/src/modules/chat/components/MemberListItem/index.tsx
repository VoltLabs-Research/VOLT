import type { ReactNode } from 'react';
import Avatar from '@/shared/presentation/components/Avatar';
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
            <div className='volt-container d-flex column flex-1'>
                <p className='volt-text font-size-3 font-weight-5 color-primary'>
                    {fullName}
                </p>
            </div>
            {role && (
                <p className={`volt-text ${cn('member-list-item-role font-size-2', role)}`}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                </p>
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
        <div className={`volt-container ${cn('d-flex items-center gap-075 list-item-hoverable member-list-item', className)}`}>
            {content}
        </div>
    );
};

export default MemberListItem;
