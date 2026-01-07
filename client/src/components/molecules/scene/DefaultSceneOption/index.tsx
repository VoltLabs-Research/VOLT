import React from 'react';
import { TbObjectScan, TbSettings } from 'react-icons/tb';
import Popover from '@/components/molecules/common/Popover';
import PopoverMenuItem from '@/components/atoms/common/PopoverMenuItem';
import CanvasSidebarOption from '@/components/atoms/scene/CanvasSidebarOption';
import { useUIStore } from '@/stores/slices/ui';

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
    const openExposureSettings = useUIStore((s) => s.openExposureSettings);

    const scene = { sceneType: 'trajectory', source: 'default' as const };
    const option = {
        Icon: TbObjectScan,
        title: 'Frame Atoms',
        modifierId: ''
    };

    const active = isSceneActive(scene);

    return (
        <Popover
            id="default-option-menu"
            triggerAction="contextmenu"
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
                icon={<TbSettings size={14} />}
            >
                Settings
            </PopoverMenuItem>
        </Popover>
    );
};

export default DefaultSceneOption;
