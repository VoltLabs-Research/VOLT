import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { Redo2, Square } from 'lucide-react';
import { useMemo } from 'react';
import type { MenuOption } from '@/shared/contracts/menu';
import type { ReactElement } from 'react';

interface JobGroupMenuProps {
    trajectoryId: string;
    trigger: ReactElement;
    loadingAction: 'remove' | 'retry' | null;
    onRemoveRunningJobs: () => void;
    onRetryFailedJobs: () => void;
};

/**
 * A right-click menu, so it stays on the app's own `ContextMenuPopover` rather than
 * moving to HeroUI's `Dropdown`: the panel anchors to the pointer's coordinate, not
 * to an element, and opening it needs `preventDefault`/`stopPropagation` on a real
 * `contextmenu` event — neither of which React Aria's press model gives.
 *
 * `isLoading` per item is gone because `AsyncContextMenuItem` already awaits
 * `onClick` and shows its own spinner; `loadingAction` still disables both entries
 * while either mutation is in flight, which is what it was really for.
 */
const JobGroupMenu = ({
    trajectoryId,
    trigger,
    loadingAction,
    onRemoveRunningJobs,
    onRetryFailedJobs
}: JobGroupMenuProps) => {
    const options = useMemo<MenuOption[]>(() => [
        {
            label: 'Remove Running Jobs',
            icon: Square,
            destructive: true,
            disabled: loadingAction !== null,
            onClick: onRemoveRunningJobs
        },
        {
            label: 'Retry Failed Jobs',
            icon: Redo2,
            disabled: loadingAction !== null,
            onClick: onRetryFailedJobs
        }
    ], [loadingAction, onRemoveRunningJobs, onRetryFailedJobs]);

    return (
        <ContextMenuPopover
            id={`job-group-menu-${trajectoryId}`}
            trigger={trigger}
            options={options}
            triggerAction='contextmenu'
            ariaLabel='Job group actions'
            menuLabel='Job group actions'
        />
    );
};

export default JobGroupMenu;
