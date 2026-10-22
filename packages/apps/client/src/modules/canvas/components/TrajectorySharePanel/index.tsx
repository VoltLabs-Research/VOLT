import CopyableField from '@/shared/ui/components/CopyableField';
import TrajectoryVisibilityToggle from '@/modules/trajectory/components/TrajectoryVisibilityToggle';
import { CloseButton } from '@heroui/react';

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
            <div className='flex shrink-0 flex-row items-center justify-between gap-2 border-b border-foreground/[0.06] py-1 pl-2.5 pr-1'>
                <h4 className='text-sm font-medium text-foreground'>
                    Share trajectory
                </h4>
                {onClose && <CloseButton onPress={onClose} aria-label='Close share panel' />}
            </div>
            <div className='flex flex-col gap-3 px-1 pb-1 pt-3'>
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

                <CopyableField
                    value={shareUrl}
                    successMessage='Canvas link copied'
                    className='gap-2 rounded-full border-0 bg-foreground/5 py-1 pl-3.5 pr-1 [&_.copyable-field-value]:truncate [&_.copyable-field-value]:text-xs'
                />
            </div>
        </div>
    );
};

export default TrajectorySharePanel;
