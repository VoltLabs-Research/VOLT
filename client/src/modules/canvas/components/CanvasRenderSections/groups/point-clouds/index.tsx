import { valueRow } from '../../../CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Select from '@/shared/presentation/primitives/Select';
import Box from '@/shared/presentation/primitives/Box';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';

import { useMemo } from 'react';
import { MdGrain } from 'react-icons/md';
import { useShallow } from 'zustand/react/shallow';

import { isEnumValue } from '../../utilities';
import {
    PointCloudDetailLevel,
    PointCloudStyleMode
} from '@/modules/fractal/stores/contracts/editor/scene-types';

import type { RenderGroup } from '../../types';
import type { SelectOption } from '@/shared/presentation/primitives/Select';

const DETAIL_LEVEL_OPTIONS: SelectOption[] = [
    { title: 'Auto', value: 'auto' },
    { title: 'Performance', value: 'performance' },
    { title: 'Balanced', value: 'balanced' },
    { title: 'Quality', value: 'quality' }
];

const STYLE_OPTIONS: SelectOption[] = [
    { title: 'Flat', value: 'flat' },
    { title: 'Softened', value: 'softened' }
];

const usePointCloudGroup = (): RenderGroup => {
    const {
        pointSizeMultiplier,
        setPointSizeMultiplier,
        pointCloudSettings,
        setPointCloudSettings
    } = useEditorStore(useShallow((state) => ({
        pointSizeMultiplier: state.pointSizeMultiplier,
        setPointSizeMultiplier: state.setPointSizeMultiplier,
        pointCloudSettings: state.pointCloudSettings,
        setPointCloudSettings: state.setPointCloudSettings
    })));

    return useMemo(() => ({
        id: 'point-clouds',
        title: 'Point Clouds',
        icon: <MdGrain size={12} />,
        subsections: [
            {
                label: 'Sizing',
                sections: [{
                    key: 'point-cloud-size',
                    title: 'Point Size',
                    enabled: true,
                    rows: [
                        valueRow({
                            label: 'Point Size',
                            min: 0.1,
                            max: 5,
                            step: 0.1,
                            decimals: 1,
                            value: pointSizeMultiplier,
                            onChange: setPointSizeMultiplier
                        })
                    ],
                    extras: (
                        <Text size='xs' tone='muted'>Applies scene-wide to detected point clouds.</Text>
                    )
                }]
            },
            {
                label: 'Overrides',
                sections: [{
                    key: 'point-cloud-overrides',
                    title: 'Point Cloud Overrides',
                    enabled: pointCloudSettings.overridesEnabled,
                    onToggle: (enabled: boolean) => setPointCloudSettings({ overridesEnabled: enabled }),
                    rows: [],
                    extras: (
                        <Stack gap='05'>
                            <Box className='canvas-render-grid'>
                                <Select
                                    value={pointCloudSettings.detailLevel}
                                    onChange={(value: string) => {
                                        if (isEnumValue(value, PointCloudDetailLevel)) {
                                            setPointCloudSettings({ detailLevel: value });
                                        }
                                    }}
                                    placeholder='Detail Level'
                                    options={DETAIL_LEVEL_OPTIONS}
                                    disabled={!pointCloudSettings.overridesEnabled}
                                />
                                <Select
                                    value={pointCloudSettings.style}
                                    onChange={(value: string) => {
                                        if (isEnumValue(value, PointCloudStyleMode)) {
                                            setPointCloudSettings({ style: value });
                                        }
                                    }}
                                    placeholder='Visual Style'
                                    options={STYLE_OPTIONS}
                                    disabled={!pointCloudSettings.overridesEnabled}
                                />
                            </Box>
                            <FormFieldRHF
                                fieldKey='point-cloud-scene-opacity'
                                fieldType='checkbox'
                                label='Use Scene Opacity'
                                fieldValue={pointCloudSettings.useSceneOpacity}
                                onFieldChange={(_, next) => setPointCloudSettings({ useSceneOpacity: Boolean(next) })}
                                disabled={!pointCloudSettings.overridesEnabled}
                            />
                            <Text size='xs' tone='muted'>Detail and style overrides apply consistently to every point cloud in the scene.</Text>
                        </Stack>
                    )
                }]
            }
        ]
    }), [pointCloudSettings, pointSizeMultiplier, setPointCloudSettings, setPointSizeMultiplier]);
};

export default usePointCloudGroup;