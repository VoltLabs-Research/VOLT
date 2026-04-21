import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import useUpdateTrajectory from '@/modules/trajectory/hooks/trajectory/use-update-trajectory';
import EditableTag from '@/shared/presentation/components/EditableTag';
import { useCallback } from 'react';

interface EditableTrajectoryNameProps {
    trajectoryId: string;
    name: string;
    className?: string;
    allowSingleClickPropagation?: boolean;
};

export default function EditableTrajectoryName({
    trajectoryId,
    name,
    className = '',
    allowSingleClickPropagation = false
}: EditableTrajectoryNameProps) {
    const user = useCurrentUser();
    const updateTrajectory = useUpdateTrajectory();

    const handleSave = useCallback((newName: string): void => {
        if (newName !== name) {
            updateTrajectory(trajectoryId, { name: newName });
        }
    }, [name, trajectoryId, updateTrajectory]);

    if (!user) {
        return (
            <p className={`volt-text editable-name ${className}`} title={name}>
                {name}
            </p>
        );
    }

    return (
        <EditableTag
            as='p'
            onSave={handleSave}
            className={`editable-name ${className}`}
            title={name}
            allowSingleClickPropagation={allowSingleClickPropagation}
        >
            {name}
        </EditableTag>
    );
}
