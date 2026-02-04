import React from 'react';
import { TbObjectScan } from 'react-icons/tb';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import CanvasSidebarOption from '@/modules/canvas/presentation/components/atoms/CanvasSidebarOption';
import useCanvasUIStore from '@/modules/canvas/presentation/stores/use-canvas-ui-store';

interface DefaultSceneOptionProps {
    onSelect: (scene: any) => void;
    onAdd: (scene: any) => void;
    onRemove: (scene: any) => void;
    isSceneActive: (scene: any) => boolean;
}

const DefaultSceneOption: React.FC<DefaultSceneOptionProps> = ({
    onSelect,
    onAdd,
    onRemove,
    isSceneActive
}) => {
    const openExposureSettings = useCanvasUIStore((s) => s.openExposureSettings);

    const scene = { sceneType: 'trajectory', source: 'default' as const };
    const option = {
        Icon: TbObjectScan,
        title: 'Frame Atoms',
        modifierId: ''
    };

    const active = isSceneActive(scene);

    return (
        <Popover
            id='default-option-menu'
            triggerAction='contextmenu'
            trigger={
                <CanvasSidebarOption
                    onSelect={() => onSelect(scene)}
                    activeOption={active}
                    isLoading={false}
                    option={option}
                />
            }
        >
            <PopoverMenuItem
                onClick={() => onAdd(scene)}
                disabled={active}
            >
                Add to scene
            </PopoverMenuItem>
            <PopoverMenuItem
                onClick={() => onRemove(scene)}
                disabled={!active}
            >
                Remove from scene
            </PopoverMenuItem>
            <PopoverMenuItem
                onClick={() => openExposureSettings(scene)}
            >
                Settings
            </PopoverMenuItem>
        </Popover>
    );
};

export default DefaultSceneOption;
