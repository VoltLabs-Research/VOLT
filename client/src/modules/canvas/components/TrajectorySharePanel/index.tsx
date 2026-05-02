import CopyableField from '@/shared/presentation/components/CopyableField';
import TrajectoryVisibilityToggle from '@/modules/trajectory/components/TrajectoryVisibilityToggle';
import CloseButton from '@/shared/presentation/primitives/CloseButton';
import Divider from '@/shared/presentation/primitives/Divider';
import Heading from '@/shared/presentation/primitives/Heading';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import { useMemo } from 'react';

import './TrajectorySharePanel.css';

interface TrajectorySharePanelProps {
    trajectoryId: string;
    isPublic: boolean;
    canManageVisibility: boolean;
    onClose?: () => void;
}

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
        <Stack className='trajectory-share-panel'>
            <Row justify='between' shrink='0' className='trajectory-share-panel-header'>
                <Heading level={4} size='sm' weight='medium'>
                    Share trajectory
                </Heading>
                {onClose && <CloseButton onClick={onClose} />}
            </Row>

            <Stack gap='075' className='trajectory-share-panel-body'>
                {canManageVisibility ? (
                    <TrajectoryVisibilityToggle
                        trajectoryId={trajectoryId}
                        isPublic={isPublic}
                    />
                ) : (
                    <Stack gap='025'>
                        <Text as='p' size='sm' weight='medium' tone='primary'>
                            {isPublic ? 'Public trajectory' : 'Private trajectory'}
                        </Text>
                        <p className='font-size-05 color-tertiary'>
                            {isPublic
                                ? 'Anyone with the link can view this trajectory.'
                                : 'Only team members can view this trajectory.'}
                        </p>
                    </Stack>
                )}

                <Divider />

                <Stack gap='05'>
                    <CopyableField
                        value={shareUrl}
                        successMessage='Canvas link copied'
                        className='trajectory-share-link-field'
                    />
                </Stack>
            </Stack>
        </Stack>
    );
};

export default TrajectorySharePanel;
