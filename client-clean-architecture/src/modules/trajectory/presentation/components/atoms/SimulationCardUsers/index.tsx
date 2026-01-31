import useTrajectoryPresence from '../../../hooks/socket/use-trajectory-presence';
import { getInitialsFromUser } from '@/shared/utils/user';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './SimulationCardUsers.css';

interface SimulationCardUsersProps{
    trajectoryId: string;
    maxDisplay?: number;
};

const SimulationCardUsers = ({ trajectoryId, maxDisplay = 3 }: SimulationCardUsersProps) => {
    const { users } = useTrajectoryPresence(trajectoryId);

    if(users.length === 0) return null;

    const displayedUsers = users.slice(0, maxDisplay);
    const remainingCount = users.length - maxDisplay;

    return (
        <Container className='d-flex items-center simulation-card-users p-absolute'>
            {displayedUsers.map((user) => (
                <Container 
                    key={user.id} 
                    className='d-flex flex-center user-avatar radius-full' 
                    title={`${user.firstName ?? ''} ${user.lastName ?? ''}`}
                >
                    {user.avatar ? (
                        <img src={user.avatar} alt={user.firstName ?? 'User'} className='w-max h-max radius-full' />
                    ) : (
                        <Paragraph className='font-size-1 font-weight-5'>
                            {getInitialsFromUser(user)}
                        </Paragraph>
                    )}
                </Container>
            ))}
            {remainingCount > 0 && (
                <Container className='d-flex flex-center user-avatar radius-full overflow'>
                    <Paragraph className='font-size-1'>+{remainingCount}</Paragraph>
                </Container>
            )}
        </Container>
    );
};

export default SimulationCardUsers;
