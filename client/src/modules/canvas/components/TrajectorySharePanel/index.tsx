import CloseButton from '@/shared/presentation/components/CloseButton';
import CopyableField from '@/shared/presentation/components/CopyableField';
import TrajectoryVisibilityToggle from '@/modules/trajectory/components/TrajectoryVisibilityToggle';
import { useMemo } from 'react';

import './TrajectorySharePanel.css';

interface TrajectorySharePanelProps {
    trajectoryId: string;
    isPublic: boolean;
    canManageVisibility: boolean;
    onClose?: () => void;
};

const buildCanvasUrl = (trajectoryId: string): string => {
    if (typeof window === 'undefined') {
        return `/canvas/${trajectoryId}`;
    }

    return `${window.location.origin}/canvas/${trajectoryId}`;
};

const TrajectorySharePanel = ({
    trajectoryId,
    isPublic,
    canManageVisibility,
    onClose
}: TrajectorySharePanelProps) => {
    const shareUrl = useMemo(() => buildCanvasUrl(trajectoryId), [trajectoryId]);

    return (
        <div className='volt-container trajectory-share-panel d-flex column'>
            <div className='volt-container trajectory-share-panel-header d-flex items-center content-between f-shrink-0'>
                <h4 className='volt-title font-size-1 font-weight-5 color-primary'>
                    Share trajectory
                </h4>
                {onClose && <CloseButton onClick={onClose} />}
            </div>

            <div className='volt-container trajectory-share-panel-body d-flex column gap-075'>
                {canManageVisibility ? (
                    <TrajectoryVisibilityToggle
                        trajectoryId={trajectoryId}
                        isPublic={isPublic}
                    />
                ) : (
                    <div className='volt-container d-flex column gap-025'>
                        <p className='volt-text font-size-1 font-weight-5 color-primary'>
                            {isPublic ? 'Public trajectory' : 'Private trajectory'}
                        </p>
                        <p className='volt-text font-size-05 color-tertiary'>
                            {isPublic
                                ? 'Anyone with the link can view this trajectory.'
                                : 'Only team members can view this trajectory.'}
                        </p>
                    </div>
                )}

                <hr className="volt-divider volt-divider--horizontal" />

                <div className='volt-container d-flex column gap-05'>
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
