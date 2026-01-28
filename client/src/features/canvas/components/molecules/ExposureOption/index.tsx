import React, { useMemo } from 'react';
import { TbObjectScan, TbSettings } from 'react-icons/tb';
import Popover from '@/components/molecules/common/Popover';
import PopoverMenuItem from '@/components/atoms/common/PopoverMenuItem';
import CanvasSidebarOption from '@/features/canvas/components/atoms/CanvasSidebarOption';
import DynamicIcon from '@/components/atoms/common/DynamicIcon';
import { useUIStore } from '@/stores/slices/ui';

interface ExposureOptionProps {
    exposure: any;
    analysisId: string;
    index: number;
    onSelect: (scene: any) => void;
    onAdd: (scene: any) => void;
    onRemove: (scene: any) => void;
    isActive: boolean;
}

const ExposureOption: React.FC<ExposureOptionProps> = ({
    exposure,
    analysisId,
    index,
    onSelect,
    onAdd,
    onRemove,
    isActive
}) => {
    const openExposureSettings = useUIStore((s) => s.openExposureSettings);

    const sceneObject = useMemo(() => ({
        sceneType: exposure.exposureId,
        source: 'plugin' as const,
        analysisId: exposure.analysisId,
        exposureId: exposure.exposureId
    }), [exposure.exposureId, exposure.analysisId]);

    const Icon = useMemo(() => {
        const IconComponent = () => (
            exposure.icon ? <DynamicIcon iconName={exposure.icon} /> : <TbObjectScan />
        );
        return IconComponent;
    }, [exposure.icon]);

    return (
        <Popover
            id={`exposure-option-menu-${analysisId}-${index}`}
            triggerAction="contextmenu"
            trigger={
                <CanvasSidebarOption
                    onSelect={() => onSelect(sceneObject)}
                    activeOption={isActive}
                    isLoading={false}
                    option={{
                        Icon,
                        title: exposure.name || exposure.exposureId,
                        modifierId: exposure.modifierId || ''
                    }}
                />
            }
        >
            <PopoverMenuItem
                onClick={() => onAdd(sceneObject)}
                disabled={isActive}
            >
                Add to scene
            </PopoverMenuItem>
            <PopoverMenuItem
                onClick={() => onRemove(sceneObject)}
                disabled={!isActive}
            >
                Remove from scene
            </PopoverMenuItem>
            <PopoverMenuItem
                onClick={() => openExposureSettings(sceneObject)}
            >
                Settings
            </PopoverMenuItem>
        </Popover>
    );
};

export default React.memo(ExposureOption);
