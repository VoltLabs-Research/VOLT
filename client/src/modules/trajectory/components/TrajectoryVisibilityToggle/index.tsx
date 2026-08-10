import { Switch } from '@heroui/react';
import { CANVAS_QUERY_KEYS } from '@/modules/canvas/hooks/queries';
import { TRAJECTORY_QUERY_KEYS, trajectoryQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import queryClient from '@/shared/query/query-client';
import { sileo } from 'sileo';
import { useCallback, useState } from 'react';

interface TrajectoryVisibilityToggleProps {
    trajectoryId: string;
    isPublic: boolean;
    disabled?: boolean;
    onChange?: (nextIsPublic: boolean) => void;
}

const TrajectoryVisibilityToggle = ({
    trajectoryId,
    isPublic,
    disabled,
    onChange
}: TrajectoryVisibilityToggleProps) => {
    const updateMutation = trajectoryQuery.useUpdateMutation();
    const [optimisticValue, setOptimisticValue] = useState<boolean | null>(null);

    const effectivePublic = optimisticValue ?? isPublic;

    const handleChange = useCallback(async (nextPressed: boolean) => {
        if (nextPressed === effectivePublic) {
            return;
        }

        setOptimisticValue(nextPressed);

        try {
            await updateMutation.mutateAsync({
                id: trajectoryId,
                params: { isPublic: nextPressed }
            });

            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: CANVAS_QUERY_KEYS.bootstrap({ trajectoryId })
                }),
                queryClient.invalidateQueries({
                    queryKey: CANVAS_QUERY_KEYS.trajectory({ trajectoryId })
                }),
                queryClient.invalidateQueries({
                    queryKey: TRAJECTORY_QUERY_KEYS.trajectory(trajectoryId)
                })
            ]);

            onChange?.(nextPressed);
            sileo.success({
                title: nextPressed
                    ? 'Trajectory is now public'
                    : 'Trajectory is now private'
            });
        } catch (error) {
            reportError(error, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Failed to update visibility'
            });
        } finally {
            setOptimisticValue(null);
        }
    }, [effectivePublic, onChange, trajectoryId, updateMutation]);

    const labelId = `trajectory-visibility-label-${trajectoryId}`;
    const descriptionId = `trajectory-visibility-description-${trajectoryId}`;

    return (
        <div className='flex flex-row items-center justify-between gap-4'>
            <div className='flex flex-col gap-1 flex-1'>
                <h4 className='text-xs font-medium text-foreground' id={labelId}>
                    Public visibility
                </h4>
                <p className='text-xs text-muted' id={descriptionId}>
                    Anyone with the link can view this trajectory.
                </p>
            </div>
            <Switch
                isSelected={effectivePublic}
                onChange={handleChange}
                isDisabled={disabled || updateMutation.isPending}
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
            >
                <Switch.Content>
                    <Switch.Control>
                        <Switch.Thumb />
                    </Switch.Control>
                </Switch.Content>
            </Switch>
        </div>
    );
};

export default TrajectoryVisibilityToggle;
