import EditableTag from '@/components/atoms/common/EditableTag';
import Tooltip from '@/components/atoms/common/Tooltip';
import { useTrajectoryStore } from '@/features/trajectory/stores';
import { useAuthStore } from '@/features/auth/stores';
import Title from '@/components/primitives/Title';
import type { Trajectory } from '@/types/models';

interface EditableTrajectoryNameProps {
    trajectory: Trajectory,
    className: string;
};

const EditableTrajectoryName = ({ trajectory, className }: EditableTrajectoryNameProps) => {
    const updateTrajectoryById = useTrajectoryStore((state) => state.updateTrajectoryById);
    const user = useAuthStore((state) => state.user);
    const isAuthenticated = !!user;

    const handleNameUpdate = async (newName: string) => {
        if (!isAuthenticated) return;
        try {
            await updateTrajectoryById(trajectory._id, { name: newName });
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

