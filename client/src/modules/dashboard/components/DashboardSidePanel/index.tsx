import JobsDrawer from '@/modules/dashboard/components/JobsDrawer';
import ClustersDrawer from '@/modules/dashboard/components/ClustersDrawer';
import { useDashboardSidePanelStore } from '@/modules/dashboard/store/use-side-panel-store';
import { cn } from '@heroui/react';

const PANEL_WIDTH_CLASS = 'w-[280px] min-[1024.05px]:w-60';

const DashboardSidePanel = () => {
    const openPanel = useDashboardSidePanelStore((state) => state.openPanel);
    const lastPanel = useDashboardSidePanelStore((state) => state.lastPanel);
    const isOpen = openPanel !== null;
    const shownPanel = openPanel ?? lastPanel;

    return (
        <aside
            className={cn(
                'flex h-dvh shrink-0 flex-col overflow-hidden bg-transparent transition-[width] duration-[420ms] ease-out-fluid',
                isOpen ? PANEL_WIDTH_CLASS : 'w-0'
            )}
            aria-hidden={!isOpen}
        >
            <div className={cn('flex h-full flex-col overflow-hidden', PANEL_WIDTH_CLASS)}>
                <div className={cn('h-full min-h-0', shownPanel === 'jobs' ? '' : 'hidden')}>
                    <JobsDrawer />
                </div>
                <div className={cn('h-full min-h-0', shownPanel === 'clusters' ? '' : 'hidden')}>
                    <ClustersDrawer />
                </div>
            </div>
        </aside>
    );
};

export default DashboardSidePanel;
