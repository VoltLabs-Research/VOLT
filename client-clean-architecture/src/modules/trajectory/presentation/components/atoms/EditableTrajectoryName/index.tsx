import EditableTag from '@/shared/presentation/components/atoms/common/EditableTag';
import Tooltip from '@/shared/presentation/components/atoms/common/Tooltip';
import { useUpdateTrajectory } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';
import { useAuthStore } from '@/modules/auth/presentation/stores';
import Title from '@/shared/presentation/components/primitives/Title';
import type { Trajectory } from '@/modules/trajectory/domain/entities';

interface EditableTrajectoryNameProps {
    trajectory: Trajectory,
    className: string;
};

const EditableTrajectoryName = ({ trajectory, className }: EditableTrajectoryNameProps) => {
    const updateMutation = useUpdateTrajectory();
    const user = useAuthStore((state) => state.user);
    const isAuthenticated = !!user;

    const handleNameUpdate = async (newName: string) => {
        if (!isAuthenticated) return;
        try {
            await updateMutation.mutateAsync({ id: trajectory._id, data: { name: newName } });
        } catch (error: any) {
            console.error('Failed to update trajectory name:', error);
            throw error;
        }
    };

    return (
        isAuthenticated ? (
            <Tooltip content="Double-click to edit name" placement="bottom">
                <EditableTag
                    as='h3'
                    className={className}
                    onSave={handleNameUpdate}
                >
                    {trajectory?.name}
                </EditableTag>
            </Tooltip>
        ) : (
            <Title className={className}>{trajectory?.name}</Title>
        )
    );
};

export default EditableTrajectoryName;
