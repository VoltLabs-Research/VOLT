import React, { useMemo } from 'react';
import { TbObjectScan } from 'react-icons/tb';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import CanvasSidebarOption from '@/modules/canvas/presentation/components/atoms/CanvasSidebarOption';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import useCanvasUIStore from '@/modules/canvas/presentation/stores/use-canvas-ui-store';

interface ExposureOptionProps {
    exposure: any;
    analysisId: string;
    index: number;
    onSelect: (scene: any) => void;
    onAdd: (scene: any) => void;
    onRemove: (scene: any) => void;
    isActive: boolean;
    isSelected?: boolean;
    isInProgress?: boolean;
}

const ExposureOption: React.FC<ExposureOptionProps> = ({
    exposure,
    analysisId,
    index,
    onSelect,
    onAdd,
    onRemove,
    isActive,
    isSelected = false,
    isInProgress = false
}) => {
    const openExposureSettings = useCanvasUIStore((s) => s.openExposureSettings);

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
            triggerAction='contextmenu'
            trigger={
                <CanvasSidebarOption
                    onSelect={() => {
                        if (isInProgress) return;
                        onSelect(sceneObject);
                    }}
                    onContextMenu={(event: React.MouseEvent) => {
                        if (isInProgress) {
                            event.preventDefault();
                            event.stopPropagation();
                        }
                    }}
                    activeOption={isActive}
                    isSelected={isSelected}
                    isLoading={false}
                    option={{
                        Icon,
                        title: exposure.name,
                        modifierId: exposure.modifierId || ''
                    }}
                    className={isInProgress ? 'cursor-progress' : ''}
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
