import CopyableField from '@/shared/ui/components/CopyableField';
import TrajectoryVisibilityToggle from '@/modules/trajectory/components/TrajectoryVisibilityToggle';
import { CloseButton, Separator } from '@heroui/react';

interface TrajectorySharePanelProps {
    trajectoryId: string;
    isPublic: boolean;
    canManageVisibility: boolean;
    onClose?: () => void;
}

const buildCanvasUrl = (trajectoryId: string): string => {
    return `${window.location.origin}/canvas/${trajectoryId}`;
};

const TrajectorySharePanel = ({
    trajectoryId,
    isPublic,
    canManageVisibility,
    onClose
}: TrajectorySharePanelProps) => {
    const shareUrl = buildCanvasUrl(trajectoryId);

    return (
        <div className='flex h-auto flex-col'>
            <div className='flex shrink-0 flex-row items-center justify-between border-b border-border px-3 py-2.5'>
                <h4 className='text-xs font-medium text-foreground'>
                    Share trajectory
                </h4>
                {onClose && <CloseButton onPress={onClose} aria-label='Close share panel' />}
            </div>
            <div className='flex flex-col gap-3 p-3'>
                {canManageVisibility ? (
                    <TrajectoryVisibilityToggle
                        trajectoryId={trajectoryId}
                        isPublic={isPublic}
                    />
                ) : (
                    <div className='flex flex-col gap-1'>
                        <p className='text-xs font-medium text-foreground'>
                            {isPublic ? 'Public trajectory' : 'Private trajectory'}
                        </p>
                        <p className='text-xs text-muted'>
                            {isPublic
                                ? 'Anyone with the link can view this trajectory.'
                                : 'Only team members can view this trajectory.'}
                        </p>
                    </div>
                )}

                <Separator />
                <div className='flex flex-col gap-2'>
                    <CopyableField
                        value={shareUrl}
                        successMessage='Canvas link copied'
                        className='px-2.5 py-2 [&_.copyable-field-value]:text-2xs'
                    />
                </div>
            </div>
        </div>
    );
};

export default TrajectorySharePanel;
