import './UserInfo.css';
import { cn } from '@/shared/utils';
import { Avatar, Row, Text } from '@/shared/presentation/primitives';
import type { User } from '@/modules/auth/api/entities/user';
import type { ReactNode } from 'react';

enum UserInfoVariant {
    Default = 'default',
    Compact = 'compact'
};

interface UserInfoProps {
    user: User | null;
    showStatus?: boolean;
    isOnline?: boolean;
    variant?: UserInfoVariant;
    suffix?: ReactNode;
    className?: string;
};

const UserInfo = ({ 
    user, 
    showStatus = false, 
    isOnline = false, 
    variant = UserInfoVariant.Default,
    suffix,
    className 
}: UserInfoProps) => {
    return (
        <Row gap='075' width='max' justify='between' className={cn(`user-info-${variant}`, className)}>
            <Avatar
                user={user}
                size='sm'
                showStatus={showStatus}
                isOnline={isOnline}
            />
            <div className='user-info-details flex-1 min-w-0'>
                <Text as='p' size='md' weight='bold' tone='primary' className='user-info-name overflow-hidden'>
                    {user?.firstName} {user?.lastName}
                    {suffix}
                </Text>
                <Text as='p' size='sm' tone='muted' className='user-info-email overflow-hidden'>
                    {user?.email}
                </Text>
            </div>
        </Row>
    );
};

export default UserInfo;
