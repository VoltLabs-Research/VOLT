import { colorField, row } from '../../../CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { ENVIRONMENT_SUBSECTION_TITLES } from '@/shared/domain/rendering/environment';

import { useMemo } from 'react';
import { MdNature } from 'react-icons/md';
import { useShallow } from 'zustand/react/shallow';

import type { RenderGroup } from '../../types';

const useEnvironmentGroup = (): RenderGroup => {
    const environment = useEditorStore(useShallow((state) => state.environment));
    const isPointCloudScene = useEditorStore((s) => s.isPointCloudScene);

    return useMemo(() => {
        const backgroundSection = {
            key: 'background',
            title: ENVIRONMENT_SUBSECTION_TITLES.background,
            enabled: true,
            rows: [],
            extras: colorField('backgroundColor', 'Background Color', environment.backgroundColor, (value: string) => {
                environment.setBackgroundColor(value);
            })
        };

        const fogSection = {
            key: 'fog',
            title: 'Fog',
            enabled: environment.enableFog,
            onToggle: (enabled: boolean) => environment.setFogConfig({ enableFog: enabled }),
            rows: [
                row({ label: 'Near', min: 0, max: Math.max(10, environment.fogFar), step: 0.1, decimals: 2 }, () => environment.fogNear, (value: number) => {
                    environment.setFogConfig({ fogNear: Math.min(value, environment.fogFar) });
                }),
                row({ label: 'Far', min: Math.max(0, environment.fogNear + 0.1), max: 5000, step: 0.1, decimals: 2 }, () => environment.fogFar, (value: number) => {
                    environment.setFogConfig({ fogFar: Math.max(value, environment.fogNear + 0.1) });
                })
            ],
            extras: colorField('fogColor', 'Fog Color', environment.fogColor, (value: string) => {
                environment.setFogConfig({ fogColor: value });
            })
        };

        return {
            id: 'environment',
            title: 'Environment',
            icon: <MdNature size={12} />,
            subsections: [
                { label: ENVIRONMENT_SUBSECTION_TITLES.background, sections: [backgroundSection] },
                {
                    label: ENVIRONMENT_SUBSECTION_TITLES.fog,
                    sections: [fogSection],
                    ...(isPointCloudScene
                        ? { disabled: true, disabledReason: 'Not compatible with point cloud scenes' }
                        : {})
                }
            ]
        };
    }, [environment, isPointCloudScene]);
};

export default useEnvironmentGroup;
