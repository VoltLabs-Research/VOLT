import { useState } from 'react';
import { Button } from '@heroui/react';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import GradientPreview from '../../GradientPreview';
import useStageConfig from '@/modules/canvas/hooks/use-stage-config';
import usePropertySelector from '@/modules/trajectory/hooks/particle-filter/use-property-selector';
import { colorCodingStatsQuery } from '@/modules/trajectory/hooks/color-coding/queries';
import colorCodingService from '@/modules/trajectory/api/services/color-coding-service';
import { COLORMAP_NAMES } from '@/modules/fractal/services/colormaps';
import { parseNumericInput } from '../../../utils/parse-numeric-input';
import { showPromise } from '@/shared/ui/hooks/toast';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { useEditorStore } from '@/modules/canvas/store/editor';
import type { ColorCodingStageConfig } from '../../../store/canvas-pipeline';

interface ColorCodingStageEditorProps {
    stageId: string;
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
}

const GRADIENT_OPTIONS = COLORMAP_NAMES.map((name) => ({
    value: name,
    title: name
}));

const BAKE_TOAST = createPromiseToastOptions({
    loading: 'Baking color-coded model…',
    success: 'Color-coded model baked',
    error: 'Failed to bake color-coded model'
});

const ColorCodingStageEditor = ({
    stageId,
    trajectoryId,
    analysisId,
    currentTimestep,
    canMutateCanvas
}: ColorCodingStageEditorProps) => {
    const { config, patch } = useStageConfig<ColorCodingStageConfig>(stageId, trajectoryId);
    const setActiveScene = useEditorStore((s) => s.setActiveScene);

    const gradient = config?.gradient ?? 'Viridis';
    const manualRange = config?.manualRange;

    const {
        property,
        propertyValue,
        propertyType,
        propertyOptions,
        exposureId: selectedExposureId,
        handlePropertyChange,
        isLoading
    } = usePropertySelector({
        trajectoryId,
        analysisId,
        timestep: currentTimestep
    });
    const exposureId = selectedExposureId ?? undefined;

    const [minInput, setMinInput] = useState(() => (manualRange ? String(manualRange.min) : ''));
    const [maxInput, setMaxInput] = useState(() => (manualRange ? String(manualRange.max) : ''));
    const [isApplying, setIsApplying] = useState(false);

    const canApply = Boolean(
        canMutateCanvas
        && trajectoryId
        && currentTimestep !== undefined
        && property
        && !isApplying
    );

    const handleApply = async () => {
        if (!trajectoryId || currentTimestep === undefined || !property) return;

        setIsApplying(true);
        try {
            let startValue: number;
            let endValue: number;
            const manualMin = parseNumericInput(minInput);
            const manualMax = parseNumericInput(maxInput);
            if (manualMin !== null && manualMax !== null) {
                startValue = manualMin;
                endValue = manualMax;
            } else {
                const stats = await colorCodingStatsQuery.fetch({
                    trajectoryId,
                    analysisId,
                    timestep: currentTimestep,
                    property,
                    type: exposureId ? 'modifier' : 'base',
                    exposureId
                });
                startValue = stats.min;
                endValue = stats.max;
            }

            await showPromise(
                colorCodingService.apply({
                    trajectoryId,
                    analysisId,
                    timestep: currentTimestep,
                    payload: {
                        property,
                        startValue,
                        endValue,
                        gradient,
                        ...(exposureId ? { exposureId } : {})
                    }
                }),
                BAKE_TOAST
            );

            setActiveScene({
                analysisId,
                endValue: String(endValue),
                exposureId: exposureId ?? '',
                gradient,
                property,
                source: 'color-coding',
                startValue: String(startValue),
                sceneType: 'color-coding'
            });

            window.dispatchEvent(new CustomEvent('canvas:scene-artifacts:changed', {
                detail: {
                    trajectoryId,
                    source: 'color-coding',
                    timestep: currentTimestep
                }
            }));

            patch({
                property,
                propertyValue,
                propertyType,
                exposureId,
                manualRange: {
                    min: startValue,
                    max: endValue
                },
            });
        } catch {
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <div className='flex flex-col gap-2'>
            <FormFieldRHF
                fieldKey='color-coding-property'
                fieldType='select'
                label='Property'
                fieldValue={propertyValue}
                onFieldChange={(_, value) => handlePropertyChange(String(value))}
                options={propertyOptions}
                variant='canvas'
            />

            {propertyType === 'string' ? (
                <span className='text-xs text-muted'>
                    Categorical property — baked with a discrete palette.
                </span>
            ) : (
                <>
                    <FormFieldRHF
                        fieldKey='color-coding-gradient'
                        fieldType='select'
                        label='Color Gradient'
                        fieldValue={gradient}
                        onFieldChange={(_, value) => patch({ gradient: String(value) })}
                        options={GRADIENT_OPTIONS}
                        variant='canvas'
                    />

                    <GradientPreview gradient={gradient} startValue={0} endValue={1} />

                    <span className='text-xs text-muted'>
                        Range (leave blank to auto-compute on the cluster)
                    </span>
                    <FormFieldRHF
                        fieldKey='color-coding-min'
                        fieldType='input'
                        label='Start value'
                        fieldValue={minInput}
                        onFieldChange={(_, value) => setMinInput(String(value))}
                        inputProps={{ inputMode: 'decimal' }}
                        variant='canvas'
                    />
                    <FormFieldRHF
                        fieldKey='color-coding-max'
                        fieldType='input'
                        label='End value'
                        fieldValue={maxInput}
                        onFieldChange={(_, value) => setMaxInput(String(value))}
                        inputProps={{ inputMode: 'decimal' }}
                        variant='canvas'
                    />
                </>
            )}

            <Button
                variant='primary'
                size='sm'
                fullWidth
                isPending={isApplying}
                onPress={() => { void handleApply(); }}
                isDisabled={!canApply || isLoading}
                className='text-xs'
            >
                Apply (bake)
            </Button>
        </div>
    );
};

export default ColorCodingStageEditor;
