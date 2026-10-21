import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import useUpdateTrajectory from './use-update-trajectory';
import EditableTag from '@/shared/ui/components/EditableTag';
import { useCallback } from 'react';
import { isWasmLocalTrajectoryId } from '@/modules/canvas-wasm/constants';

interface EditableTrajectoryNameProps {
    trajectoryId: string;
    name: string;
    className?: string;
    allowSingleClickPropagation?: boolean;
    readOnly?: boolean;
}

export default function EditableTrajectoryName({
    trajectoryId,
    name,
    className = '',
    allowSingleClickPropagation = false,
    readOnly = false
}: EditableTrajectoryNameProps) {
    const user = useCurrentUser();
    const updateTrajectory = useUpdateTrajectory();

    const handleSave = useCallback((newName: string): void => {
        if (newName !== name) {
            updateTrajectory(trajectoryId, { name: newName });
        }
    }, [name, trajectoryId, updateTrajectory]);

    if (readOnly || !user || isWasmLocalTrajectoryId(trajectoryId)) {
        return (
            <p className={`editable-name ${className}`} title={name}>
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
