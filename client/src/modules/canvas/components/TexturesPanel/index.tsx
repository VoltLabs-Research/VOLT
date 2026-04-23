import useJobStatusCounts from '../../hooks/use-job-status-counts';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import StatusCounts from '../StatusCounts';
import { Stack, Box } from '@/shared/presentation/primitives';

import { Activity } from 'lucide-react';
import JobsHistoryViewer from '@/modules/jobs/components/JobsHistoryViewer';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

import './TexturesPanel.css';

interface TexturesPanelProps {
    trajectory: Trajectory | null | undefined;
};

const EVENTS_ICON_COLOR = 'var(--color-text-secondary)';

const TexturesPanel = ({ trajectory }: TexturesPanelProps) => {
    const statusCounts = useJobStatusCounts(trajectory?._id);

    return (
        <Stack minH='0' overflow='hidden' className="canvas-textures-panel">
            <PanelHeader
                icon={<Activity style={{ width: 13, height: 13, color: EVENTS_ICON_COLOR }} />}
                title="Events"
                variant="compact"
                actions={
                    <StatusCounts
                        queued={statusCounts.queued}
                        running={statusCounts.running}
                        completed={statusCounts.completed}
                    />
                }
            />

            <Box flex='1' overflow='auto' minH='0' className="canvas-events-body">
                <JobsHistoryViewer
                    trajectoryId={trajectory?._id}
                    hideAfterComplete={false}
                    variant="embedded"
                    displayMode="children-only"
                    autoSelectAnalysis={false}
                />
            </Box>
        </Stack>
    );
};

export default TexturesPanel;
