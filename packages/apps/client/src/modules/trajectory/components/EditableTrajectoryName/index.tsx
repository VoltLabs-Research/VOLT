import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import useUpdateTrajectory from './use-update-trajectory';
import EditableTag from '@/shared/ui/components/EditableTag';
import { useCallback } from 'react';

interface EditableTrajectoryNameProps {
    trajectoryId: string;
    name: string;
    className?: string;
    onSingleClick?: () => void;
    readOnly?: boolean;
    editing?: boolean;
    onEditingChange?: (isEditing: boolean) => void;
}

export default function EditableTrajectoryName({
    trajectoryId,
    name,
    className = '',
    onSingleClick,
    readOnly = false,
    editing,
    onEditingChange
}: EditableTrajectoryNameProps) {
    const user = useCurrentUser();
    const updateTrajectory = useUpdateTrajectory();

    const handleSave = useCallback((newName: string): void => {
        if (newName !== name) {
            updateTrajectory(trajectoryId, { name: newName });
        }
    }, [name, trajectoryId, updateTrajectory]);

    if (readOnly || !user) {
        return (
            <p className={className} title={name}>
                {name}
            </p>
        );
    }

    return (
        <EditableTag
            as='p'
            onSave={handleSave}
            className={className}
            title={name}
            onSingleClick={onSingleClick}
            editing={editing}
            onEditingChange={onEditingChange}
        >
            {name}
        </EditableTag>
    );
}
