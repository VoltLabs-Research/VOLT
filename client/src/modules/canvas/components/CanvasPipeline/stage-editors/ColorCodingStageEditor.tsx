import { useCallback, useMemo, useState } from 'react';
import { Button, Stack, Text } from '@voltstack/bravais';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import GradientPreview from '../../GradientPreview';
import { useCanvasPipelineStore } from '../../../stores/canvas-pipeline';
import usePropertySelector from '@/modules/trajectory/hooks/particle-filter/use-property-selector';
import { colorCodingStatsQuery } from '@/modules/trajectory/hooks/color-coding/queries';
import colorCodingService from '@/modules/trajectory/api/services/color-coding-service';
import { COLORMAP_NAMES, type ColormapName } from '@/modules/fractal/services/colormaps';
import { parseNumericInput } from '../../../utilities/parse-numeric-input';
import { showPromise } from '@/shared/ui/hooks/toast';
import { createPromiseToastOptions } from '@/shared/ui/utilities/toast-options';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import type { ColorCodingStageConfig } from '../../../stores/canvas-pipeline';

interface ColorCodingStageEditorProps {
    stageId: string;
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
}

const isColormapName = (value: string): value is ColormapName =>
    (COLORMAP_NAMES as ReadonlyArray<string>).includes(value);

/**
 * Color-coding pipeline stage. Unlike the old client-eval recolor (which fetched
 * the entire property column into the browser and looped over it — unscalable at
 * 100M atoms), this bakes on the daemon: the range is computed server-side from the
 * parquet (getColorCodingStats) when no manual range is given, then apply() enqueues
 * a colored-GLB bake that lands as a selectable scene in the Scene Collection.
 */
const ColorCodingStageEditor = ({
    stageId,
    trajectoryId,
    analysisId,
    currentTimestep,
    canMutateCanvas
}: ColorCodingStageEditorProps) => {
    const stage = useCanvasPipelineStore((s) =>
        (trajectoryId ? s.byTrajectory[trajectoryId] : undefined)?.find((entry) => entry.id === stageId)
    );
    const updateStageConfig = useCanvasPipelineStore((s) => s.updateStageConfig);
    const setActiveScene = useEditorStore((s) => s.setActiveScene);

    const config = stage?.config as ColorCodingStageConfig | undefined;
    const gradient = config?.gradient ?? 'Viridis';
    const manualRange = config?.manualRange;

    const { propertyValue, propertyType, propertyOptions, handlePropertyChange, isLoading } = usePropertySelector({
        trajectoryId,
        analysisId,
        timestep: currentTimestep
    });

    const [minInput, setMinInput] = useState(() => (manualRange ? String(manualRange.min) : ''));
    const [maxInput, setMaxInput] = useState(() => (manualRange ? String(manualRange.max) : ''));
    const [isApplying, setIsApplying] = useState(false);

    const patch = useCallback((next: Partial<ColorCodingStageConfig>) => {
        updateStageConfig(stageId, next as Partial<ColorCodingStageConfig>, trajectoryId);
    }, [stageId, trajectoryId, updateStageConfig]);

    const selectedOption = useMemo(
        () => propertyOptions.find((option) => option.value === propertyValue),
        [propertyOptions, propertyValue]
    );

    const isCategorical = propertyType === 'string';

    const gradientOptions = useMemo(
        () => COLORMAP_NAMES.map((name) => ({ value: name, title: name })),
        []
    );

    const colorCodingToast = useMemo(() => createPromiseToastOptions({
        loading: 'Baking color-coded model…',
        success: 'Color-coded model baked',
        error: 'Failed to bake color-coded model'
    }), []);

    const canApply = Boolean(
        canMutateCanvas
        && trajectoryId
        && currentTimestep !== undefined
        && selectedOption
        && selectedOption.property
        && !isApplying
    );

    const handleApply = useCallback(async () => {
        if (!trajectoryId || currentTimestep === undefined || !selectedOption?.property) return;
        const property = selectedOption.property;
        const exposureId = selectedOption.exposureId ?? undefined;
        const statsType = exposureId ? 'modifier' : 'base';

        setIsApplying(true);
        patch({ runStatus: 'loading' });
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
                    type: statsType,
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
                    payload: { property, startValue, endValue, gradient, ...(exposureId ? { exposureId } : {}) }
                }),
                colorCodingToast
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
                detail: { trajectoryId, source: 'color-coding', timestep: currentTimestep }
            }));

            patch({
                property,
                propertyValue,
                propertyType,
                exposureId,
                manualRange: { min: startValue, max: endValue },
                lastBakedKey: `${property}:${startValue}-${endValue}:${gradient}`,
                runStatus: 'success'
            });
        } catch {
            patch({ runStatus: 'error' });
        } finally {
            setIsApplying(false);
        }
    }, [
        trajectoryId, analysisId, currentTimestep, selectedOption, gradient,
        minInput, maxInput, propertyValue, propertyType, patch, setActiveScene, colorCodingToast
    ]);

    return (
        <Stack gap='05'>
            <FormFieldRHF
                fieldKey='color-coding-property'
                fieldType='select'
                label='Property'
                fieldValue={propertyValue}
                onFieldChange={(_, value) => handlePropertyChange(String(value))}
                options={propertyOptions}
                variant='canvas'
            />

            {isCategorical ? (
                <Text size='xs' tone='muted'>
                    Categorical property — baked with a discrete palette.
                </Text>
            ) : (
                <>
                    <FormFieldRHF
                        fieldKey='color-coding-gradient'
                        fieldType='select'
                        label='Color Gradient'
                        fieldValue={gradient}
                        onFieldChange={(_, value) => { if (isColormapName(String(value))) patch({ gradient: String(value) }); }}
                        options={gradientOptions}
                        variant='canvas'
                    />

                    <GradientPreview gradient={gradient} startValue={0} endValue={1} />

                    <Text size='xs' tone='muted'>
                        Range (leave blank to auto-compute on the cluster)
                    </Text>
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
                variant='solid'
                intent='brand'
                size='sm'
                shape='rounded'
                block
                isLoading={isApplying}
                onClick={() => { void handleApply(); }}
                disabled={!canApply || isLoading}
                className='font-size-05'
            >
                Apply (bake)
            </Button>
        </Stack>
    );
};

export default ColorCodingStageEditor;
