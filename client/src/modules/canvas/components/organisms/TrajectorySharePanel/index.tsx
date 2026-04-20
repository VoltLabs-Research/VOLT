import CloseButton from '@/shared/presentation/components/CloseButton';
import Container from '@/shared/presentation/components/Container';
import CopyableField from '@/shared/presentation/components/CopyableField';
import Divider from '@/shared/presentation/components/Divider';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import TrajectoryVisibilityToggle from '@/modules/trajectory/components/molecules/TrajectoryVisibilityToggle';
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
        <Container className='trajectory-share-panel d-flex column'>
            <Container className='trajectory-share-panel-header d-flex items-center content-between f-shrink-0'>
                <Title as='h4' className='font-size-1 font-weight-5 color-primary'>
                    Share trajectory
                </Title>
                {onClose && <CloseButton onClick={onClose} />}
            </Container>

            <Container className='trajectory-share-panel-body d-flex column gap-075'>
                {canManageVisibility ? (
                    <TrajectoryVisibilityToggle
                        trajectoryId={trajectoryId}
                        isPublic={isPublic}
                    />
                ) : (
                    <Container className='d-flex column gap-025'>
                        <Paragraph className='font-size-1 font-weight-5 color-primary'>
                            {isPublic ? 'Public trajectory' : 'Private trajectory'}
                        </Paragraph>
                        <Paragraph className='font-size-05 color-tertiary'>
                            {isPublic
                                ? 'Anyone with the link can view this trajectory.'
                                : 'Only team members can view this trajectory.'}
                        </Paragraph>
                    </Container>
                )}

                <Divider />

                <Container className='d-flex column gap-05'>
                    <CopyableField
                        value={shareUrl}
                        successMessage='Canvas link copied'
                        className='trajectory-share-link-field'
                    />
                </Container>
            </Container>
        </Container>
    );
};

export default TrajectorySharePanel;
