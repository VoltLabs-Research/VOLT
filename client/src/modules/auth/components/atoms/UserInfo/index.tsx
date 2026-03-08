import './UserInfo.css';
import { cn } from '@/shared/utils';
import Avatar from '@/shared/presentation/components/Avatar';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
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
        <Container className={cn('d-flex gap-075 w-max items-center content-between', `user-info-${variant}`, className)}>
            <Avatar 
                user={user} 
                size='sm' 
                showStatus={showStatus}
                isOnline={isOnline}
            />
            <Container className='user-info-details'>
                <Paragraph className='user-info-name overflow-hidden font-size-2 font-weight-6 color-primary'>
                    {user?.firstName} {user?.lastName}
                    {suffix}
                </Paragraph>
                <Paragraph className='user-info-email overflow-hidden font-size-1 color-muted'>
                    {user?.email}
                </Paragraph>
            </Container>
        </Container>
    );
};

export default UserInfo;
