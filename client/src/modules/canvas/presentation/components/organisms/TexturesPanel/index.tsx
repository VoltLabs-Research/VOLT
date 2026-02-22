import { Activity } from 'lucide-react';
import PanelHeader from '../../atoms/PanelHeader';
import Container from '@/shared/presentation/components/Container';
import { JobsHistoryViewer } from '@/modules/jobs/presentation/components/organisms/JobsHistoryViewer';
import type { Trajectory } from '@/modules/trajectory/domain/entities/Trajectory';
import StatusCounts from '../../molecules/StatusCounts';
import useJobStatusCounts from '../../../hooks/useJobStatusCounts';
import './TexturesPanel.css';

interface TexturesPanelProps {
    trajectory: Trajectory | null | undefined;
}

const TexturesPanel = ({ trajectory }: TexturesPanelProps) => {
    const statusCounts = useJobStatusCounts(trajectory?._id);

    return (
        <Container className="canvas-textures-panel d-flex column min-h-0 overflow-hidden">
            <PanelHeader
                icon={<Activity style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.35)' }} />}
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
