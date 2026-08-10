import CopyableField from '@/shared/ui/components/CopyableField';
import TrajectoryVisibilityToggle from '@/modules/trajectory/components/TrajectoryVisibilityToggle';
import { CloseButton, Divider } from '@voltstack/bravais';

import './TrajectorySharePanel.css';

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
        <div className='flex flex-col trajectory-share-panel'>
            <div className='flex flex-row items-center justify-between shrink-0 trajectory-share-panel-header'>
                <h4 className='text-xs font-medium text-foreground'>
                    Share trajectory
                </h4>
                {onClose && <CloseButton onClick={onClose} />}
            </div>

            <div className='flex flex-col gap-3 trajectory-share-panel-body'>
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

                <Divider />

                <div className='flex flex-col gap-2'>
                    <CopyableField
                        value={shareUrl}
                        successMessage='Canvas link copied'
                        className='trajectory-share-link-field'
                    />
                </div>
            </div>
        </div>
    );
};

export default TrajectorySharePanel;
