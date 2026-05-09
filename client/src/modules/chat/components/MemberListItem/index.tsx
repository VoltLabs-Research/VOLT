import type { ReactNode } from 'react';
import Avatar from '@/shared/presentation/primitives/Avatar';
import ListRow from '@/shared/presentation/primitives/ListRow';
import Tag from '@/shared/presentation/primitives/Tag';
import type { TagProps } from '@/shared/presentation/primitives/Tag';
import { cn } from '@/shared/utils/cn';
import type { User } from '@/modules/auth/api/entities/user';
import './MemberListItem.css';

type MemberRole = 'owner' | 'admin' | 'member';

interface MemberListItemProps {
    user: User;
    role?: MemberRole;
    action?: ReactNode;
    onClick?: () => void;
    className?: string;
}

const ROLE_TAG_CONFIG: Record<MemberRole, { tone: TagProps['tone']; variant: TagProps['variant'] }> = {
    owner: { tone: 'info', variant: 'solid' },
    admin: { tone: 'brand', variant: 'solid' },
    member: { tone: 'neutral', variant: 'soft' }
};

export const MemberListItem = ({ user, role, action, onClick, className }: MemberListItemProps) => {
    const fullName = `${user.firstName} ${user.lastName}`;

    let trailing: ReactNode = null;
    if (role || action) {
        const tagConfig = role ? ROLE_TAG_CONFIG[role] : null;
        trailing = (
            <>
                {role && tagConfig && (
                    <Tag tone={tagConfig.tone} variant={tagConfig.variant} size='xs'>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Tag>
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
