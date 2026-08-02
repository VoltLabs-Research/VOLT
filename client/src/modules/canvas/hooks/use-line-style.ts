import lineStyleService from '@/modules/trajectory/api/services/line-style-service';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import useLineStyleEntityInspector from './use-line-style-entity-inspector';
import useLineStyleFilterRows from './use-line-style-filter-rows';
import { buildLineStyleSpec } from '../utils/line-style-spec';
import { goldenRatioColor, rgbaToHex } from '../utils/line-style-colors';
import { resolveLineSceneSource } from '@/modules/fractal/utils/scene-utils';
import { uniqueValuesQuery } from '@/modules/trajectory/hooks/particle-filter/queries';
import { colorCodingStatsQuery } from '@/modules/trajectory/hooks/color-coding/queries';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { LineStyleScene, LineStyleSpec } from '@/modules/fractal/contracts/scene';
import type { ColormapName } from '@/modules/fractal/services/colormaps';
import type { IExposureProperty } from '@volt/contracts/modules/plugin/exposure';
import type { LineStyleTarget } from '../utils/line-style-spec';

export type { LineStyleFilterRow } from '../utils/line-style-spec';

export type LineColorMode = NonNullable<LineStyleSpec['colorMode']>;

interface UseLineStyleOptions {
    trajectoryId?: string;
    currentTimestep?: number;
}

interface LineEntityProperty {
    name: string;
    label: string;
}

interface LineCategoryOption {
    value: string;
    swatch: string;
}

/**
 * `IExposureExport.options` is a `Record<string, unknown>` in `@volt/contracts`
 * because every exporter writes its own shape. The line exporter's shape is
 * fixed (ClusterDaemon `plugin/services/exports/export-node-processor-types.ts`)
 * so it is declared once here instead of being probed field by field.
 */
interface LineExportOptions {
    colorBy?: string;
    propertyColors?: Record<string, [number, number, number, number]>;
}

type LineSceneSource = NonNullable<ReturnType<typeof resolveLineSceneSource>>;

const useLineStyle = (options: UseLineStyleOptions = {}) => {
    const { trajectoryId, currentTimestep } = options;

    const { activeScenes, addScene, removeScene, setActiveScene } = useEditorStore(useShallow((state) => ({
        activeScenes: state.activeScenes,
        addScene: state.addScene,
        removeScene: state.removeScene,
        setActiveScene: state.setActiveScene
    })));

    // An already baked line-style scene wins over the raw plugin line result it
    // replaced, so re-applying keeps editing the same exposure.
    const source = useMemo((): LineSceneSource | null => {
        const candidates = activeScenes
            .map(resolveLineSceneSource)
            .filter((candidate): candidate is LineSceneSource => candidate !== null);

        return candidates.find((candidate) => candidate.scene.source === 'line-style')
            ?? candidates[0]
            ?? null;
    }, [activeScenes]);

    const target = useMemo((): LineStyleTarget | null => {
        if (!source || !trajectoryId || currentTimestep === undefined) {
            return null;
        }
        return {
            trajectoryId,
            analysisId: source.analysisId,
            exposureId: source.exposureId,
            timestep: currentTimestep
        };
    }, [source, trajectoryId, currentTimestep]);

    const { plugins } = usePluginSelectors();

    const sourceExposure = useMemo(() => {
        if (!source) return undefined;
        for (const plugin of plugins) {
            const exposure = plugin.exposures?.find((candidate) => candidate._id === source.exposureId);
            if (exposure) return exposure;
        }
        return undefined;
    }, [plugins, source]);

    const exportOptions = sourceExposure?.export?.options as LineExportOptions | undefined;

    const { stringProperties, numberProperties } = useMemo(() => {
        const toEntityProperty = (property: IExposureProperty): LineEntityProperty => ({
            name: property.key,
            label: property.label || property.key
        });
        const properties = sourceExposure?.properties ?? [];

        return {
            stringProperties: properties.filter((property) => property.type === 'string').map(toEntityProperty),
            numberProperties: properties.filter((property) => property.type !== 'string').map(toEntityProperty)
        };
    }, [sourceExposure]);

    const [colorMode, setColorMode] = useState<LineColorMode>('category');
    const [categoryPropertyValue, setCategoryPropertyValue] = useState<string | null>(null);
    const [hiddenCategories, setHiddenCategories] = useState<Record<string, boolean>>({});
    const [uniformColorHex, setUniformColorHex] = useState('#ff8000');
    const [gradientPropertyValue, setGradientPropertyValue] = useState<string | null>(null);
    const [gradient, setGradient] = useState<ColormapName>('Jet');
    const [startInput, setStartInput] = useState('');
    const [endInput, setEndInput] = useState('');
    const [lineWidthInput, setLineWidthInput] = useState('');
    const [categoryCounts, setCategoryCounts] = useState<Record<string, number> | null>(null);
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const categoryProperty = useMemo(() => {
        const isKnown = (name: string) => stringProperties.some((property) => property.name === name);
        const { colorBy } = exportOptions ?? {};

        if (categoryPropertyValue && isKnown(categoryPropertyValue)) return categoryPropertyValue;
        if (colorBy && isKnown(colorBy)) return colorBy;
        return stringProperties[0]?.name ?? '';
    }, [categoryPropertyValue, exportOptions, stringProperties]);

    const gradientProperty = useMemo(() => {
        if (gradientPropertyValue && numberProperties.some((property) => property.name === gradientPropertyValue)) {
            return gradientPropertyValue;
        }
        return numberProperties[0]?.name ?? '';
    }, [gradientPropertyValue, numberProperties]);

    const handleCategoryPropertyChange = useCallback((value: string) => {
        setCategoryPropertyValue(value);
        setHiddenCategories({});
        setCategoryCounts(null);
    }, []);

    const uniqueValuesResult = uniqueValuesQuery(
        target && categoryProperty ? {
            trajectoryId: target.trajectoryId,
            analysisId: target.analysisId,
            exposureId: target.exposureId,
            timestep: target.timestep,
            property: categoryProperty,
            maxValues: 50
        } : {
            trajectoryId: '',
            timestep: 0,
            property: ''
        },
        {
            enabled: Boolean(target) && Boolean(categoryProperty),
            retry: false,
            staleTime: 5 * 60 * 1000
        }
    );

    const categoryOptions = useMemo((): LineCategoryOption[] => {
        const values = (uniqueValuesResult.data?.values ?? []).map(String);
        let fallbackIndex = 0;

        return [...values].sort().map((value) => {
            const explicit = exportOptions?.propertyColors?.[value];
            if (explicit) {
                return {
                    value,
                    swatch: rgbaToHex(explicit)
                };
            }
            const swatch = goldenRatioColor(fallbackIndex);
            fallbackIndex += 1;
            return {
                value,
                swatch
            };
        });
    }, [uniqueValuesResult.data, exportOptions]);

    const toggleCategory = useCallback((value: string) => {
        setHiddenCategories((current) => ({
            ...current,
            [value]: !current[value]
        }));
    }, []);

    const statsQuery = colorCodingStatsQuery(
        target && gradientProperty ? {
            trajectoryId: target.trajectoryId,
            analysisId: target.analysisId,
            exposureId: target.exposureId,
            timestep: target.timestep,
            property: gradientProperty,
            type: 'modifier'
        } : {
            trajectoryId: '',
            timestep: 0,
            property: '',
            type: 'modifier'
        },
        { enabled: colorMode === 'gradient' && Boolean(target) && Boolean(gradientProperty) }
    );

    useEffect(() => {
        if (statsQuery.data) {
            setStartInput(String(statsQuery.data.min));
            setEndInput(String(statsQuery.data.max));
        }
    }, [statsQuery.data]);

    const { filterRows, addFilterRow, removeFilterRow, updateFilterRow } = useLineStyleFilterRows(
        numberProperties[0]?.name ?? ''
    );

    const handleApply = async () => {
        if (!target) {
            setError('Add a line result to the scene first');
            return;
        }

        setError(null);
        setIsApplying(true);
        try {
            const style = buildLineStyleSpec({
                colorMode,
                categoryProperty,
                hiddenCategories,
                uniformColorHex,
                gradientProperty,
                gradient,
                startInput,
                endInput,
                lineWidthInput,
                filterRows
            });
            const response = await lineStyleService.apply({
                ...target,
                style
            });

            setCategoryCounts(response.categoryCounts);

            const styledScene: LineStyleScene = {
                sceneType: 'line-style',
                source: 'line-style',
                analysisId: target.analysisId,
                exposureId: target.exposureId,
                style
            };

            // Every previous styling of this exposure is superseded by the new bake.
            const replaced = activeScenes.filter((scene) => {
                const candidate = resolveLineSceneSource(scene);
                return candidate !== null
                    && (scene.source === 'line-style' || candidate.exposureId === target.exposureId);
            });
            if (replaced.length > 0) {
                replaced.forEach(removeScene);
                addScene(styledScene);
            } else {
                setActiveScene(styledScene);
            }

            window.dispatchEvent(new CustomEvent('canvas:scene-artifacts:changed', {
                detail: { trajectoryId: target.trajectoryId }
            }));
        } catch (applyError: unknown) {
            setError(reportError(applyError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to style line entities'
            }).title);
        } finally {
            setIsApplying(false);
        }
    };

    const inspector = useLineStyleEntityInspector(target);

    return {
        hasLineSource: Boolean(source),
        colorMode,
        setColorMode,
        stringProperties,
        numberProperties,
        categoryProperty,
        setCategoryProperty: handleCategoryPropertyChange,
        categoryOptions,
        isLoadingCategories: uniqueValuesResult.isFetching,
        categoryCounts,
        hiddenCategories,
        toggleCategory,
        uniformColorHex,
        setUniformColorHex,
        gradientProperty,
        setGradientProperty: setGradientPropertyValue,
        gradient,
        setGradient,
        startInput,
        setStartInput,
        endInput,
        setEndInput,
        filterRows,
        addFilterRow,
        removeFilterRow,
        updateFilterRow,
        lineWidthInput,
        setLineWidthInput,
        isApplying,
        handleApply,
        error,
        ...inspector
    };
};

export default useLineStyle;
