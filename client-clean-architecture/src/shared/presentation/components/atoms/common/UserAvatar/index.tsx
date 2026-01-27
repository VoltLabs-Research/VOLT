import './UserAvatar.css';
import React from 'react';

interface UserAvatarProps {
    src?: string | null;
    initials?: string;
    rounded?: boolean;
    className?: string;
    onClick?: () => void;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ 
    src, 
    initials, 
    rounded = false, 
    className = '',
    onClick 
}) => {
    return (
        <div 
            className={`user-avatar-container ${className}`} 
            data-rounded={rounded}
            onClick={onClick}
        >
            {src ? (
                <img src={src} alt="Avatar" className="user-avatar-img" />
            ) : (
                <span className="user-avatar-initials">{initials || '?'}</span>
            )}
        </div>
    );
};

export default UserAvatar;
