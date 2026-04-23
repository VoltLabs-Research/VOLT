import useTrajectoryPresence from '@/modules/trajectory/hooks/trajectory/use-trajectory-presence';
import { AvatarStack } from '@/shared/presentation/primitives';
import { Box } from '@/shared/presentation/primitives';
import './SimulationCardUsers.css';

interface SimulationCardUsersProps {
    trajectoryId: string;
    maxDisplay?: number;
};

export default function SimulationCardUsers({ trajectoryId, maxDisplay = 3 }: SimulationCardUsersProps) {
    const { users } = useTrajectoryPresence(trajectoryId);
    const viewersLabel = `${users.length} active collaborator${users.length === 1 ? '' : 's'}`;

    if (users.length === 0) {
        return null;
    }

    return (
        <Box position='absolute' className='simulation-card-users' title={viewersLabel} aria-label={viewersLabel}>
            <AvatarStack users={users} maxDisplay={maxDisplay} size='xs' />
        </Box>
    );
}
