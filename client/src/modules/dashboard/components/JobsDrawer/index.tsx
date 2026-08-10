import './JobsDrawer.css';
import { Modal } from '@voltstack/bravais';
import StatusCounts from '@/modules/canvas/components/StatusCounts';
import useJobStatusCounts from '@/modules/canvas/hooks/use-job-status-counts';
import JobsHistoryViewer from '@/modules/jobs/components/JobsHistoryViewer';
import { DASHBOARD_DRAWER_IDS, useJobsDrawerStore } from '@/modules/dashboard/store/use-jobs-drawer-store';

const JobsDrawer = () => {
    const trajectoryId = useJobsDrawerStore((state) => state.trajectoryId);
    const trajectoryName = useJobsDrawerStore((state) => state.trajectoryName);
    const counts = useJobStatusCounts(trajectoryId ?? undefined);

    const scopeLabel = trajectoryId
        ? trajectoryName ?? 'Selected trajectory'
        : 'All trajectories';

    return (
        <Modal
            id={DASHBOARD_DRAWER_IDS.jobs}
            placement='right'
            title='Compute jobs'
            description={scopeLabel}
            lazyMount
        >
            <div className='dashboard-jobs-drawer'>
                <div className='dashboard-jobs-drawer-summary'>
                    <StatusCounts
                        queued={counts.queued}
                        running={counts.running}
                        completed={counts.completed}
                        failed={counts.failed}
                    />
                    {counts.queued + counts.running + counts.completed + counts.failed === 0 && (
                        <span className='text-xs text-muted'>No compute jobs yet.</span>
                    )}
                </div>

                <div className='dashboard-jobs-drawer-body'>
                    <JobsHistoryViewer
                        trajectoryId={trajectoryId ?? undefined}
                        displayMode='full'
                        groupStatusPresentation='trajectory-name'
                        autoSelectAnalysis={false}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default JobsDrawer;
