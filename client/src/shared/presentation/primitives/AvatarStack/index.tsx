import { Avatar, Row, Text } from '@/shared/presentation/primitives';
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
        <Row className={`avatar-stack ${className}`}>
            {displayedUsers.map((user, index) => (
                <Avatar
                    key={user._id ?? user.id ?? index}
                    user={user as User}
                    size={size}
                    className='avatar-stack-item'
                />
            ))}
            {remainingCount > 0 && (
                <div className={`avatar-stack-overflow avatar avatar-${size} d-flex flex-center radius-full`}>
                    <Text as='p' weight='bold' className='avatar-initials'>+{remainingCount}</Text>
                </div>
            )}
        </Row>
    );
};

export default AvatarStack;
