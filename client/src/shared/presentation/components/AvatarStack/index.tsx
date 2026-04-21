import Avatar from '@/shared/presentation/components/Avatar';
import './AvatarStack.css';
import type { User } from '@/modules/auth/api/entities/user';

type StackSize = 'xs' | 'sm' | 'md';

type AvatarStackUser = Partial<Pick<User, 'email' | 'firstName' | 'lastName' | 'avatar' | 'isOnline'>> & {
    _id?: string;
    id?: string;
};

interface AvatarStackProps {
    users: AvatarStackUser[];
    maxDisplay?: number;
    size?: StackSize;
    className?: string;
};

const AvatarStack = ({ users, maxDisplay = 3, size = 'sm', className = '' }: AvatarStackProps) => {
    if(users.length === 0) return null;

    const displayedUsers = users.slice(0, maxDisplay);
    const remainingCount = users.length - maxDisplay;

    return (
        <div className={`volt-container avatar-stack d-flex items-center ${className}`}>
            {displayedUsers.map((user, index) => (
                <Avatar
                    key={user._id ?? user.id ?? index}
                    user={user as User}
                    size={size}
                    className='avatar-stack-item'
                />
            ))}
            {remainingCount > 0 && (
                <div className={`volt-container avatar-stack-overflow avatar avatar-${size} d-flex flex-center radius-full`}>
                    <p className='volt-text avatar-initials font-weight-6'>+{remainingCount}</p>
                </div>
            )}
        </div>
    );
};

export default AvatarStack;
