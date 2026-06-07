import Avatar from '@/shared/presentation/primitives/Avatar';
import Row from '@/shared/presentation/primitives/Row';
import Text from '@/shared/presentation/primitives/Text';
import './AvatarStack.css';
import { forwardRef } from 'react';
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

const AvatarStack = forwardRef<HTMLElement, AvatarStackProps>(({ users, maxDisplay = 3, size = 'sm', className = '' }, ref) => {
    if(users.length === 0) return null;

    const displayedUsers = users.slice(0, maxDisplay);
    const remainingCount = users.length - maxDisplay;

    return (
        <Row ref={ref} className={`avatar-stack ${className}`}>
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
});

AvatarStack.displayName = 'AvatarStack';

export default AvatarStack;
