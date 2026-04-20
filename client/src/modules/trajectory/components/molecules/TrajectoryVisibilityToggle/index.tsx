import Container from '@/shared/presentation/components/Container';
import LiquidToggle from '@/shared/presentation/components/LiquidToggle';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
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
        <Container className='d-flex items-center content-between gap-1'>
            <Container className='d-flex column gap-025 flex-1'>
                <Title id={labelId} as='h4' className='font-size-1 font-weight-5 color-primary'>
                    Public visibility
                </Title>
                <Paragraph id={descriptionId} className='font-size-05 color-tertiary'>
                    Anyone with the link can view this trajectory.
                </Paragraph>
            </Container>
            <LiquidToggle
                pressed={effectivePublic}
                onChange={handleChange}
                disabled={disabled || updateMutation.isPending}
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
            />
        </Container>
    );
};

export default TrajectoryVisibilityToggle;
