import type { User } from '@/modules/auth/domain/entities/User';
import Avatar from '@/shared/presentation/components/Avatar';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './AvatarStack.css';

type StackSize = 'xs' | 'sm' | 'md';

interface AvatarStackProps {
    users: Partial<User>[];
    maxDisplay?: number;
    size?: StackSize;
    className?: string;
};

const AvatarStack = ({ users, maxDisplay = 3, size = 'sm', className = '' }: AvatarStackProps) => {
    if(users.length === 0) return null;

    const displayedUsers = users.slice(0, maxDisplay);
    const remainingCount = users.length - maxDisplay;

    return (
        <Container className={`avatar-stack d-flex items-center ${className}`}>
            {displayedUsers.map((user, index) => (
                <Avatar
                    key={user._id ?? index}
                    user={user as User}
                    size={size}
                    className='avatar-stack-item'
                />
            ))}
            {remainingCount > 0 && (
                <Container className={`avatar-stack-overflow avatar avatar-${size} d-flex flex-center radius-full`}>
                    <Paragraph className='avatar-initials font-weight-6'>+{remainingCount}</Paragraph>
                </Container>
            )}
        </Container>
    );
};

export default AvatarStack;
