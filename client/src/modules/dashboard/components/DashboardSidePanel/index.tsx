import JobsDrawer from '@/modules/dashboard/components/JobsDrawer';
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

/*
 * Jobs is the only panel left, so there is nothing to switch on: the drawer stays
 * mounted and the <aside> animates its width. Keeping it mounted while closed is
 * deliberate — unmounting it would blank the panel the moment the close animation
 * starts, instead of sliding away with its content still in it.
 */
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
