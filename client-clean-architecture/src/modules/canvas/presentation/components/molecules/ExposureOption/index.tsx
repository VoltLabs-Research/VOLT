import React from 'react';
import { TbObjectScan } from 'react-icons/tb';
import CanvasSidebarOption from '@/modules/canvas/presentation/components/atoms/CanvasSidebarOption';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import SceneOptionMenu from '@/modules/canvas/presentation/components/molecules/SceneOptionMenu';

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
    const sceneObject = {
        sceneType: exposure.exposureId,
        source: 'plugin' as const,
        analysisId: exposure.analysisId,
        exposureId: exposure.exposureId
    };

    const Icon = exposure.icon ? () => <DynamicIcon iconName={exposure.icon} /> : TbObjectScan;

    const settingsKey = `plugin:${sceneObject.analysisId}:${sceneObject.exposureId}`;

    return (
        <SceneOptionMenu
            id={`exposure-option-menu-${analysisId}-${index}`}
            isActive={isActive}
            settingsKey={settingsKey}
            onAdd={() => onAdd(sceneObject)}
            onRemove={() => onRemove(sceneObject)}
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
        />
    );
};

export default React.memo(ExposureOption);
