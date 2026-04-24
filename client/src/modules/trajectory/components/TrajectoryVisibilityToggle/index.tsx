import Heading from '@/shared/presentation/primitives/Heading';
import LiquidToggle from '@/shared/presentation/primitives/LiquidToggle';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import { CANVAS_QUERY_KEYS } from '@/modules/canvas/hooks/queries';
import { TRAJECTORY_QUERY_KEYS, trajectoryQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import queryClient from '@/shared/infrastructure/query/query-client';
import { sileo } from 'sileo';
import { useCallback, useState } from 'react';

interface TrajectoryVisibilityToggleProps {
    trajectoryId: string;
    isPublic: boolean;
    disabled?: boolean;
    onChange?: (nextIsPublic: boolean) => void;
};

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
            setOptimisticValue(null);
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
        <Row justify='between' gap='1'>
            <Stack gap='025' flex='1'>
                <Heading level={4} id={labelId} size='sm' weight='medium' tone='primary'>
                    Public visibility
                </Heading>
                <Text as='p' id={descriptionId} size='xs' className='color-tertiary'>
                    Anyone with the link can view this trajectory.
                </Text>
            </Stack>
            <LiquidToggle
                pressed={effectivePublic}
                onChange={handleChange}
                disabled={disabled || updateMutation.isPending}
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
            />
        </Row>
    );
};

export default TrajectoryVisibilityToggle;
