import useJobStatusCounts from '../../../hooks/use-job-status-counts';
import PanelHeader from '../../atoms/PanelHeader';
import StatusCounts from '../../molecules/StatusCounts';

import { Activity } from 'lucide-react';
import JobsHistoryViewer from '@/modules/jobs/components/organisms/JobsHistoryViewer';
import Container from '@/shared/presentation/components/Container';

import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

import './TexturesPanel.css';

interface TexturesPanelProps {
    trajectory: Trajectory | null | undefined;
};

const EVENTS_ICON_COLOR = 'var(--color-text-secondary)';

const TexturesPanel = ({ trajectory }: TexturesPanelProps) => {
    const statusCounts = useJobStatusCounts(trajectory?._id);

    return (
        <Container className="canvas-textures-panel d-flex column min-h-0 overflow-hidden">
            <PanelHeader
                icon={<Activity style={{ width: 13, height: 13, color: EVENTS_ICON_COLOR }} />}
                title="Events"
                actions={
                    <StatusCounts
                        queued={statusCounts.queued}
                        running={statusCounts.running}
                        completed={statusCounts.completed}
                    />
                }
            />

            <Container className="canvas-events-body flex-1 overflow-auto min-h-0">
                <JobsHistoryViewer
                    trajectoryId={trajectory?._id}
                    hideAfterComplete={false}
                    variant="embedded"
                    displayMode="children-only"
                />
            </Container>
        </Container>
    );
};

export default TexturesPanel;
