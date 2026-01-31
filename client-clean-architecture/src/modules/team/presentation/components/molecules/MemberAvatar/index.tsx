import React from 'react';
import Container from '@/shared/presentation/components/Container';
import StatusDot from '@/shared/presentation/components/StatusDot';
import './MemberAvatar.css';

interface MemberAvatarProps {
    src?: string;
    alt: string;
    isOnline?: boolean;
    showStatus?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
};

const MemberAvatar: React.FC<MemberAvatarProps> = ({
    src,
    alt,
    isOnline = false,
    showStatus = true,
    size = 'md',
    className = ''
}) => {
    const initials = alt
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const classes = [
        'member-avatar',
        `size-${size}`,
        className
    ].filter(Boolean).join(' ');

    return (
        <Container className={`${classes} p-relative`}>
            {src ? (
                <img src={src} alt={alt} className='member-avatar-img' />
            ) : (
                <Container className='member-avatar-fallback d-flex items-center content-center'>
                    {initials}
                </Container>
            )}
            {showStatus && (
                <StatusDot isOnline={isOnline} className='member-avatar-status p-absolute' />
            )}
        </Container>
    );
};

export default MemberAvatar;
