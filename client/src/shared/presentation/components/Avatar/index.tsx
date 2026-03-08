import type { ReactNode } from 'react';
import type { User } from '@/modules/auth/api/entities/user';
import { getInitialsFromUser } from '@/shared/utils/user';
import { cn } from '@/shared/utils/cn';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import StatusDot from '@/shared/presentation/components/StatusDot';
import './Avatar.css';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

interface AvatarProps {
    src?: string | null;
    alt?: string;
    fallback?: string;
    user?: User | null;
    size?: AvatarSize;
    className?: string;
    isOnline?: boolean;
    showStatus?: boolean;
    icon?: ReactNode;
};

const Avatar = ({ 
    src, 
    alt, 
    fallback, 
    user, 
    size = 'md', 
    className = '',
    isOnline = false,
    showStatus = false,
    icon
}: AvatarProps) => {
    const imageSrc = src ?? user?.avatar;
    const initials = fallback ?? (user ? getInitialsFromUser(user) : '?');
    const altText = alt ?? (user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'Avatar');

    return (
        <Container className={cn('avatar', `avatar-${size}`, 'd-flex flex-center radius-full overflow-hidden f-shrink-0 p-relative', className)}>
            {icon ? (
                <Container className='avatar-icon d-flex flex-center'>
                    {icon}
                </Container>
            ) : imageSrc ? (
                <img src={imageSrc} alt={altText} className='w-max h-max avatar-image' />
            ) : (
                <Paragraph className='avatar-initials font-weight-6'>
                    {initials}
                </Paragraph>
            )}
            {showStatus && (
                <StatusDot isOnline={isOnline} className='avatar-status p-absolute bottom-0 right-0' />
            )}
        </Container>
    );
};

export default Avatar;
