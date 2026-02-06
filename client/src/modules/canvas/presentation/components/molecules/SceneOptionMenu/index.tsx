import type { PropsWithChildren, ReactNode } from 'react';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import useCanvasUrlState from '@/modules/canvas/presentation/hooks/use-canvas-url-state';

interface SceneOptionMenuProps extends PropsWithChildren {
    id: string;
    isActive: boolean;
    settingsKey: string;
    onAdd: () => void;
    onRemove: () => void;
    trigger: ReactNode;
};

const SceneOptionMenu = ({
    id,
    isActive,
    settingsKey,
    onAdd,
    onRemove,
    trigger
}: SceneOptionMenuProps) => {
    const { setSettingsKey } = useCanvasUrlState();

    return (
        <Popover
            id={id}
            triggerAction='contextmenu'
            trigger={trigger}
        >
            <PopoverMenuItem
                onClick={onAdd}
                disabled={isActive}
            >
                Add to scene
            </PopoverMenuItem>
            <PopoverMenuItem
                onClick={onRemove}
                disabled={!isActive}
            >
                Remove from scene
            </PopoverMenuItem>
            <PopoverMenuItem
                onClick={() => setSettingsKey(settingsKey, { replace: true })}
            >
                Settings
            </PopoverMenuItem>
        </Popover>
    );
};

export default SceneOptionMenu;
