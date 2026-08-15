import JobsDrawer from '@/modules/dashboard/components/JobsDrawer';
import { useDashboardSidePanelStore } from '@/modules/dashboard/store/use-side-panel-store';
import { SIDE_PANEL_WIDTH_CLASS } from '@/modules/dashboard/utils/sidebar-width';
import { cn } from '@heroui/react';

const PANEL_WIDTH_CLASS = SIDE_PANEL_WIDTH_CLASS;

const DashboardSidePanel = () => {
    const isOpen = useDashboardSidePanelStore((state) => state.openPanel !== null);

    return (
        <aside
            className={cn(
                'flex h-dvh shrink-0 flex-col overflow-hidden bg-transparent transition-[width] duration-[420ms] ease-out-fluid',
                isOpen ? PANEL_WIDTH_CLASS : 'w-0'
            )}
            aria-hidden={!isOpen}
        >
            <div className={cn('flex h-full flex-col overflow-hidden', PANEL_WIDTH_CLASS)}>
                <div className='h-full min-h-0'>
                    <JobsDrawer />
                </div>
            </div>
        </aside>
    );
};

export default DashboardSidePanel;
