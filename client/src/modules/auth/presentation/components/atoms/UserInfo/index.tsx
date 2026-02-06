import type { User } from '@/modules/auth/domain/entities/User';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Avatar from '@/shared/presentation/components/Avatar';
import { cn } from '@/shared/utils/cn';
import './UserInfo.css';

type UserInfoVariant = 'default' | 'compact';

interface UserInfoProps {
    user: User | null;
    showStatus?: boolean;
    isOnline?: boolean;
    variant?: UserInfoVariant;
    suffix?: React.ReactNode;
    className?: string;
};

const UserInfo = ({ 
    user, 
    showStatus = false, 
    isOnline = false, 
    variant = 'default',
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
