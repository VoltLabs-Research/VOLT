import JobsDrawer from '@/modules/dashboard/components/JobsDrawer';
import ClustersDrawer from '@/modules/dashboard/components/ClustersDrawer';
import { useDashboardSidePanelStore } from '@/modules/dashboard/store/use-side-panel-store';
import { SIDE_PANEL_WIDTH_CLASS } from '@/modules/dashboard/utils/sidebar-width';
import { cn } from '@heroui/react';

/*
 * Applied to both the <aside> and its inner column: the aside animates between this and
 * `w-0` to open/close, so the content needs its own copy of the width to keep from
 * reflowing while that transition runs.
 *
 * The value is shared with the left rail, which matches it while this panel is open.
 */
const PANEL_WIDTH_CLASS = SIDE_PANEL_WIDTH_CLASS;

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
