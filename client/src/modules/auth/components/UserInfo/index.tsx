import { cn } from '@heroui/react';
import UserAvatar from '@/modules/auth/components/UserAvatar';
import type { User } from '@volt/contracts/modules/auth/domain';
import type { ReactNode } from 'react';

interface UserInfoProps {
    user: User | null;
    showStatus?: boolean;
    isOnline?: boolean;
    suffix?: ReactNode;
    className?: string;
}

const UserInfo = ({
    user,
    showStatus = false,
    isOnline = false,
    suffix,
    className
}: UserInfoProps) => {
    return (
        <div className={cn('flex flex-row items-center justify-between gap-3 w-full', className)}>
            <UserAvatar
                user={user}
                size='sm'
                showStatus={showStatus}
                isOnline={isOnline}
            />
            <div className='flex-1 min-w-0'>
                <p className='m-0 flex items-center gap-1 overflow-hidden text-sm font-semibold text-ellipsis whitespace-nowrap text-foreground'>
                    {user?.firstName} {user?.lastName}
                    {suffix}
                </p>
                <p className='m-0 overflow-hidden text-xs text-ellipsis whitespace-nowrap text-muted'>
                    {user?.email}
                </p>
            </div>
        </div>
    );
};

export default UserInfo;
