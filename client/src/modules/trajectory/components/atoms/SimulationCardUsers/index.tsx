import useTrajectoryPresence from '@/modules/trajectory/hooks/trajectory/use-trajectory-presence';
import Container from '@/shared/presentation/components/Container';
import AvatarStack from '@/shared/presentation/components/AvatarStack';
import './SimulationCardUsers.css';

interface SimulationCardUsersProps {
    trajectoryId: string;
    maxDisplay?: number;
};

export default function SimulationCardUsers({ trajectoryId, maxDisplay = 3 }: SimulationCardUsersProps) {
    const { users } = useTrajectoryPresence(trajectoryId);

    if (users.length === 0) return null;

    return (
        <Container className='simulation-card-users p-absolute'>
            <AvatarStack users={users} maxDisplay={maxDisplay} size='xs' />
        </Container>
    );
}
