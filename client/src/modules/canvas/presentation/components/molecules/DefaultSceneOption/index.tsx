import React from 'react';
import { TbObjectScan } from 'react-icons/tb';
import CanvasSidebarOption from '@/modules/canvas/presentation/components/atoms/CanvasSidebarOption';
import SceneOptionMenu from '@/modules/canvas/presentation/components/molecules/SceneOptionMenu';

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
    const scene = { sceneType: 'trajectory', source: 'default' as const };
    const option = {
        Icon: TbObjectScan,
        title: 'Frame Atoms',
        modifierId: ''
    };

    const active = isSceneActive(scene);

    const settingsKey = `${scene.source}:${scene.sceneType}`;

    return (
        <SceneOptionMenu
            id='default-option-menu'
            isActive={active}
            settingsKey={settingsKey}
            onAdd={() => onAdd(scene)}
            onRemove={() => onRemove(scene)}
            trigger={
                <CanvasSidebarOption
                    onSelect={() => onSelect(scene)}
                    activeOption={active}
                    isLoading={false}
                    option={option}
                />
            }
        />
    );
};

export default DefaultSceneOption;
