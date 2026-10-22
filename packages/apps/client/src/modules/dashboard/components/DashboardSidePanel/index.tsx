import JobsDrawer from '@/modules/dashboard/components/JobsDrawer';
import { useDashboardSidePanelStore } from '@/modules/dashboard/store/use-side-panel-store';
import { cn } from '@heroui/react';

// A trajectory's compute jobs, beside the page on the canvas; below 64rem it floats over the page.
const DashboardSidePanel = () => {
    const isOpen = useDashboardSidePanelStore((state) => state.openPanel !== null);

    return (
        <aside
            className={cn(
                'flex h-dvh shrink-0 flex-col overflow-hidden bg-transparent transition-[width] duration-[420ms] ease-out-fluid',
                'max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-[100] max-lg:bg-dashboard-surface max-lg:[backdrop-filter:var(--glass-backdrop)]',
                isOpen ? 'w-80 max-lg:max-w-[85vw]' : 'w-0'
            )}
            inert={!isOpen}
            aria-label='Compute jobs'
        >
            <div className='flex h-full w-80 max-w-[85vw] flex-col overflow-hidden'>
                <JobsDrawer />
            </div>
        </aside>
    );
};

export default DashboardSidePanel;
