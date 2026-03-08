import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import useUpdateTrajectory from '@/modules/trajectory/hooks/trajectory/use-update-trajectory';
import EditableTag from '@/shared/presentation/components/EditableTag';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { useCallback } from 'react';

interface EditableTrajectoryNameProps {
    trajectoryId: string;
    name: string;
    className?: string;
};

export default function EditableTrajectoryName({ trajectoryId, name, className = '' }: EditableTrajectoryNameProps) {
    const user = useCurrentUser();
    const updateTrajectory = useUpdateTrajectory();

    const handleSave = useCallback((newName: string): void => {
        if (newName !== name) {
            updateTrajectory(trajectoryId, { name: newName });
        }
    }, [name, trajectoryId, updateTrajectory]);

    if (!user) {
        return (
            <Paragraph className={`editable-name ${className}`} title={name}>
                {name}
            </Paragraph>
        );
    }

    return (
        <EditableTag
            as='p'
            onSave={handleSave}
            className={`editable-name ${className}`}
            title={name}
        >
            {name}
        </EditableTag>
    );
}
