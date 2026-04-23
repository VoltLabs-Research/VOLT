import type { ReactNode } from 'react';
import { Avatar, ListRow, Text } from '@/shared/presentation/primitives';
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

    let trailing: ReactNode = null;
    if (role || action) {
        trailing = (
            <>
                {role && (
                    <Text as='p' size='md' className={cn('member-list-item-role', role)}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                )}
                {action}
            </>
        );
    }

    return (
        <ListRow
            leading={<Avatar user={user} size='sm' />}
            title={fullName}
            trailing={trailing}
            onClick={onClick}
            className={cn('member-list-item', onClick && 'member-list-item-button', className)}
        />
    );
};

export default MemberListItem;
