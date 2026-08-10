import { valueRow, RENDER_GRID_CLASS } from '../../../CanvasRenderConfigHelpers';
import { useEditorStore } from '@/modules/canvas/store/editor';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import CanvasOptionSelect from '@/modules/canvas/components/CanvasOptionSelect';
import type { SelectOption } from '@/modules/canvas/contracts/select-option';

import { useMemo } from 'react';
import { Grip } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { isEnumValue } from '../../utils';
import {
    PointCloudDetailLevel,
    PointCloudStyleMode
} from '@/modules/fractal/contracts/editor/scene-types';

import type { RenderGroup } from '@/modules/canvas/contracts/render-sections';

const DETAIL_LEVEL_OPTIONS: SelectOption[] = [
    {
        title: 'Auto',
        value: 'auto'
    },
    {
        title: 'Performance',
        value: 'performance'
    },
    {
        title: 'Balanced',
        value: 'balanced'
    },
    {
        title: 'Quality',
        value: 'quality'
    }
];

const STYLE_OPTIONS: SelectOption[] = [
    {
        title: 'Flat',
        value: 'flat'
    },
    {
        title: 'Softened',
        value: 'softened'
    }
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
        icon: <Grip size={12} />,
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
                        <span className='text-xs text-muted'>Applies scene-wide to detected point clouds.</span>
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
                        <div className='flex flex-col gap-2'>
                            <div className={RENDER_GRID_CLASS}>
                                <CanvasOptionSelect
                                    ariaLabel='Detail level'
                                    size='compact'
                                    value={pointCloudSettings.detailLevel}
                                    onChange={(value: string) => {
                                        if (isEnumValue(value, PointCloudDetailLevel)) {
                                            setPointCloudSettings({ detailLevel: value });
                                        }
                                    }}
                                    placeholder='Detail Level'
                                    options={DETAIL_LEVEL_OPTIONS}
                                    isDisabled={!pointCloudSettings.overridesEnabled}
                                />
                                <CanvasOptionSelect
                                    ariaLabel='Visual style'
                                    size='compact'
                                    value={pointCloudSettings.style}
                                    onChange={(value: string) => {
                                        if (isEnumValue(value, PointCloudStyleMode)) {
                                            setPointCloudSettings({ style: value });
                                        }
                                    }}
                                    placeholder='Visual Style'
                                    options={STYLE_OPTIONS}
                                    isDisabled={!pointCloudSettings.overridesEnabled}
                                />
                            </div>
                            <FormFieldRHF
                                fieldKey='point-cloud-scene-opacity'
                                fieldType='checkbox'
                                label='Use Scene Opacity'
                                fieldValue={pointCloudSettings.useSceneOpacity}
                                onFieldChange={(_, next) => setPointCloudSettings({ useSceneOpacity: Boolean(next) })}
                                disabled={!pointCloudSettings.overridesEnabled}
                            />
                            <span className='text-xs text-muted'>Detail and style overrides apply consistently to every point cloud in the scene.</span>
                        </div>
                    )
                }]
            }
        ]
    }), [pointCloudSettings, pointSizeMultiplier, setPointCloudSettings, setPointSizeMultiplier]);
};

export default usePointCloudGroup;