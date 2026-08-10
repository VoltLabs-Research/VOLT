import { cn } from '@heroui/react';
import './UserInfo.css';
import { Avatar } from '@voltstack/bravais';
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
            <Avatar
                user={user}
                size='sm'
                showStatus={showStatus}
                isOnline={isOnline}
            />
            <div className='flex-1 min-w-0 user-info-details'>
                <p className='text-sm font-semibold text-foreground user-info-name overflow-hidden'>
                    {user?.firstName} {user?.lastName}
                    {suffix}
                </p>
                <p className='text-xs text-muted user-info-email overflow-hidden'>
                    {user?.email}
                </p>
            </div>
        </div>
    );
};

export default UserInfo;
