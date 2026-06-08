import CopyableField from '@/shared/presentation/components/CopyableField';
import TrajectoryVisibilityToggle from '@/modules/trajectory/components/TrajectoryVisibilityToggle';
import { CloseButton, Divider, Heading, Row, Stack, Text } from '@voltstack/bravais';

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
                        <Text as='p' size='xs' className='color-tertiary'>
                            {isPublic
                                ? 'Anyone with the link can view this trajectory.'
                                : 'Only team members can view this trajectory.'}
                        </Text>
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
