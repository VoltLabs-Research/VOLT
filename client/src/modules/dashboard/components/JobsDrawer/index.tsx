import JobsHistoryViewer from '@/modules/jobs/components/JobsHistoryViewer';
import { useJobsDrawerStore } from '@/modules/dashboard/store/use-jobs-drawer-store';
import { useDashboardSidePanelStore } from '@/modules/dashboard/store/use-side-panel-store';
import { CloseButton } from '@heroui/react';

const JobsDrawer = () => {
    const trajectoryId = useJobsDrawerStore((state) => state.trajectoryId);
    const trajectoryName = useJobsDrawerStore((state) => state.trajectoryName);
    const close = useDashboardSidePanelStore((state) => state.close);

    const scopeLabel = trajectoryId
        ? trajectoryName ?? 'Selected trajectory'
        : 'All trajectories';

    return (
        <div className='flex h-full min-h-0 flex-col'>
            <header className='flex items-start justify-between gap-2 px-4 pt-4 pb-3'>
                <div className='flex min-w-0 flex-col gap-0.5'>
                    <h2 className='text-sm font-semibold text-foreground'>Compute jobs</h2>
                    <p className='truncate text-xs text-muted'>{scopeLabel}</p>
                </div>
                <CloseButton onPress={close} aria-label='Close compute jobs panel' />
            </header>
            <div className='min-h-0 flex-1 overflow-y-auto px-2 py-2'>
                <JobsHistoryViewer
                    trajectoryId={trajectoryId ?? undefined}
                    displayMode='full'
                    autoSelectAnalysis={false}
                />
            </div>
        </div>
    );
};

export default JobsDrawer;
