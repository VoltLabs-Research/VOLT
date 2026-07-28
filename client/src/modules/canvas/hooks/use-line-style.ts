import lineStyleService from '@/modules/trajectory/api/services/line-style-service';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { uniqueValuesQuery } from '@/modules/trajectory/hooks/particle-filter/queries';
import { colorCodingStatsQuery } from '@/modules/trajectory/hooks/color-coding/queries';
import { Exporter } from '@volt/contracts/modules/plugin/domain/enums';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type {
    LineStyleScene,
    LineStyleSpec,
    PluginScene,
    SceneObjectType
} from '@/modules/fractal/contracts/scene';
import type { ColormapName } from '@/modules/fractal/services/colormaps';

export interface UseLineStyleOptions {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
}

export type LineColorMode = NonNullable<LineStyleSpec['colorMode']>;

export interface LineEntityProperty {
    name: string;
    label: string;
    type: 'number' | 'string';
}

export interface LineCategoryOption {
    value: string;
    swatch: string;
}

export interface LineStyleFilterRow {
    id: string;
    property: string;
    operator: 'gte' | 'lte';
    valueInput: string;
}

export interface InspectedLineEntity {
    entityId: number;
    properties: Record<string, unknown>;
}

const GOLDEN_RATIO = 0.618033988749895;

const isLineSource = (scene: SceneObjectType): scene is PluginScene => {
    return scene.source === 'plugin'
        && scene.sceneRenderMetadata?.exporter === Exporter.LINE;
};

const isLineStyleScene = (scene: SceneObjectType): scene is LineStyleScene => {
    return scene.source === 'line-style';
};

const hexToRgba = (hex: string): [number, number, number, number] => {
    const normalized = hex.replace('#', '');
    const red = parseInt(normalized.slice(0, 2), 16) / 255;
    const green = parseInt(normalized.slice(2, 4), 16) / 255;
    const blue = parseInt(normalized.slice(4, 6), 16) / 255;
    return [red, green, blue, 1];
};

const rgbaToHex = (rgba: [number, number, number, number]): string => {
    const toHexChannel = (value: number) => {
        return Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');
    };
    return `#${toHexChannel(rgba[0])}${toHexChannel(rgba[1])}${toHexChannel(rgba[2])}`;
};

const hslToHex = (h: number, s: number, l: number): string => {
    const hue = h * 360;
    const chroma = (1 - Math.abs((2 * l) - 1)) * s;
    const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
    const match = l - (chroma / 2);
    let red = 0;
    let green = 0;
    let blue = 0;
    if (hue < 60) { red = chroma; green = secondary; }
    else if (hue < 120) { red = secondary; green = chroma; }
    else if (hue < 180) { green = chroma; blue = secondary; }
    else if (hue < 240) { green = secondary; blue = chroma; }
    else if (hue < 300) { red = secondary; blue = chroma; }
    else { red = chroma; blue = secondary; }
    const toHexChannel = (value: number) => {
        return Math.round((value + match) * 255).toString(16).padStart(2, '0');
    };
    return `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}`;
};

const goldenRatioColor = (fallbackIndex: number): string => {
    const hue = (fallbackIndex * GOLDEN_RATIO) % 1;
    return hslToHex(hue, 0.65, 0.55);
};

const resolveExplicitColor = (
    propertyColors: unknown,
    value: string
): [number, number, number, number] | undefined => {
    if (!propertyColors || typeof propertyColors !== 'object') return undefined;
    const candidate = (propertyColors as Record<string, unknown>)[value];
    if (!Array.isArray(candidate) || candidate.length < 3) return undefined;
    const [red, green, blue, alpha] = candidate;
    if (typeof red !== 'number' || typeof green !== 'number' || typeof blue !== 'number') return undefined;
    return [red, green, blue, typeof alpha === 'number' ? alpha : 1];
};

let filterRowCounter = 0;

const buildFilterRowId = (): string => {
    filterRowCounter += 1;
    return `line-style-filter-${filterRowCounter}`;
};

const useLineStyle = (options: UseLineStyleOptions = {}) => {
    const { trajectoryId, currentTimestep } = options;

    const { activeScenes, addScene, removeScene, setActiveScene } = useEditorStore(useShallow((state) => ({
        activeScenes: state.activeScenes,
        addScene: state.addScene,
        removeScene: state.removeScene,
        setActiveScene: state.setActiveScene
    })));

    const source = useMemo(() => {
        const styledScene = activeScenes.find(isLineStyleScene);
        if (styledScene) {
            return { analysisId: styledScene.analysisId, exposureId: styledScene.exposureId };
        }

        const pluginScene = activeScenes.find(isLineSource);
        if (pluginScene) {
            return { analysisId: pluginScene.analysisId, exposureId: pluginScene.exposureId };
        }

        return null;
    }, [activeScenes]);

    const { plugins, isLoading: isLoadingProperties } = usePluginSelectors();

    const sourceExposure = useMemo(() => {
        if (!source) return undefined;
        for (const plugin of plugins) {
            const exposure = plugin.exposures?.find((candidate) => candidate._id === source.exposureId);
            if (exposure) return exposure;
        }
        return undefined;
    }, [plugins, source]);

    const entityProperties = useMemo((): LineEntityProperty[] => {
        return (sourceExposure?.properties ?? []).map((property) => ({
            name: property.key,
            label: property.label || property.key,
            type: property.type === 'string' ? 'string' : 'number'
        }));
    }, [sourceExposure]);

    const stringProperties = useMemo(() => {
        return entityProperties.filter((property) => property.type === 'string');
    }, [entityProperties]);

    const numberProperties = useMemo(() => {
        return entityProperties.filter((property) => property.type === 'number');
    }, [entityProperties]);

    const exportOptions = sourceExposure?.export?.options;

    const [colorMode, setColorMode] = useState<LineColorMode>('category');
    const [categoryPropertyValue, setCategoryPropertyValue] = useState<string | null>(null);
    const [hiddenCategories, setHiddenCategories] = useState<Record<string, boolean>>({});
    const [uniformColorHex, setUniformColorHex] = useState('#ff8000');
    const [gradientPropertyValue, setGradientPropertyValue] = useState<string | null>(null);
    const [gradient, setGradient] = useState<ColormapName>('Jet');
    const [startInput, setStartInput] = useState('');
    const [endInput, setEndInput] = useState('');
    const [filterRows, setFilterRows] = useState<LineStyleFilterRow[]>([]);
    const [lineWidthInput, setLineWidthInput] = useState('');
    const [categoryCounts, setCategoryCounts] = useState<Record<string, number> | null>(null);
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const defaultCategoryProperty = useMemo(() => {
        const colorBy = exportOptions?.colorBy;
        if (typeof colorBy === 'string' && stringProperties.some((property) => property.name === colorBy)) {
            return colorBy;
        }
        return stringProperties[0]?.name ?? '';
    }, [exportOptions, stringProperties]);

    const categoryProperty = useMemo(() => {
        if (categoryPropertyValue && stringProperties.some((property) => property.name === categoryPropertyValue)) {
            return categoryPropertyValue;
        }
        return defaultCategoryProperty;
    }, [categoryPropertyValue, defaultCategoryProperty, stringProperties]);

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

    const uniqueValuesParams = useMemo(() => {
        if (!source || !categoryProperty || !trajectoryId || currentTimestep === undefined) {
            return null;
        }
        return {
            trajectoryId,
            analysisId: source.analysisId,
            timestep: currentTimestep,
            property: categoryProperty,
            exposureId: source.exposureId,
            maxValues: 50
        };
    }, [source, categoryProperty, trajectoryId, currentTimestep]);

    const uniqueValuesResult = uniqueValuesQuery(
        uniqueValuesParams ?? { trajectoryId: '', timestep: 0, property: '' },
        {
            enabled: Boolean(uniqueValuesParams),
            retry: false,
            staleTime: 5 * 60 * 1000
        }
    );

    const categoryOptions = useMemo((): LineCategoryOption[] => {
        const values = (uniqueValuesResult.data?.values ?? []).map(String);
        const sorted = [...values].sort();
        let fallbackIndex = 0;
        return sorted.map((value) => {
            const explicit = resolveExplicitColor(exportOptions?.propertyColors, value);
            if (explicit) {
                return { value, swatch: rgbaToHex(explicit) };
            }
            const swatch = goldenRatioColor(fallbackIndex);
            fallbackIndex += 1;
            return { value, swatch };
        });
    }, [uniqueValuesResult.data, exportOptions]);

    const toggleCategory = useCallback((value: string) => {
        setHiddenCategories((current) => ({ ...current, [value]: !current[value] }));
    }, []);

    const statsParams = useMemo(() => {
        if (!source || !gradientProperty || !trajectoryId || currentTimestep === undefined) {
            return null;
        }
        return {
            trajectoryId,
            analysisId: source.analysisId,
            timestep: currentTimestep,
            property: gradientProperty,
            type: 'modifier',
            exposureId: source.exposureId
        };
    }, [source, gradientProperty, trajectoryId, currentTimestep]);

    const statsQuery = colorCodingStatsQuery(
        statsParams ?? { trajectoryId: '', timestep: 0, property: '', type: 'modifier' },
        { enabled: colorMode === 'gradient' && Boolean(statsParams) }
    );

    useEffect(() => {
        if (statsQuery.data) {
            setStartInput(String(statsQuery.data.min));
            setEndInput(String(statsQuery.data.max));
        }
    }, [statsQuery.data]);

    const addFilterRow = useCallback(() => {
        setFilterRows((current) => [...current, {
            id: buildFilterRowId(),
            property: numberProperties[0]?.name ?? '',
            operator: 'gte',
            valueInput: ''
        }]);
    }, [numberProperties]);

    const removeFilterRow = useCallback((rowId: string) => {
        setFilterRows((current) => current.filter((row) => row.id !== rowId));
    }, []);

    const updateFilterRow = useCallback((rowId: string, patch: Partial<Omit<LineStyleFilterRow, 'id'>>) => {
        setFilterRows((current) => current.map((row) => {
            if (row.id !== rowId) return row;
            return { ...row, ...patch };
        }));
    }, []);

    const buildStyle = useCallback((): LineStyleSpec => {
        const style: LineStyleSpec = { colorMode };

        const hidden = Object.entries(hiddenCategories).filter(([, isHidden]) => isHidden);
        if (hidden.length > 0) {
            style.categoryVisibility = Object.fromEntries(hidden.map(([value]) => [value, false]));
        }

        if (colorMode === 'category' && categoryProperty) {
            style.colorProperty = categoryProperty;
        }

        if (colorMode === 'uniform') {
            style.uniformColor = hexToRgba(uniformColorHex);
        }

        if (colorMode === 'gradient' && gradientProperty) {
            style.colorProperty = gradientProperty;
            style.gradient = gradient;

            const startValue = Number(startInput);
            if (startInput.trim() !== '' && Number.isFinite(startValue)) {
                style.startValue = startValue;
            }
            const endValue = Number(endInput);
            if (endInput.trim() !== '' && Number.isFinite(endValue)) {
                style.endValue = endValue;
            }
        }

        const lineWidth = Number(lineWidthInput);
        if (lineWidthInput.trim() !== '' && Number.isFinite(lineWidth) && lineWidth > 0) {
            style.lineWidth = lineWidth;
        }

        const filters = filterRows.flatMap((row) => {
            const value = Number(row.valueInput);
            if (!row.property || row.valueInput.trim() === '' || !Number.isFinite(value)) {
                return [];
            }
            return [{ property: row.property, operator: row.operator, value }];
        });
        if (filters.length > 0) {
            style.filters = filters;
        }

        return style;
    }, [
        colorMode,
        hiddenCategories,
        categoryProperty,
        uniformColorHex,
        gradientProperty,
        gradient,
        startInput,
        endInput,
        lineWidthInput,
        filterRows
    ]);

    const handleApply = useCallback(async () => {
        if (!trajectoryId || currentTimestep === undefined || !source) {
            setError('Add a line result to the scene first');
            return;
        }

        setError(null);
        setIsApplying(true);
        try {
            const style = buildStyle();
            const response = await lineStyleService.apply({
                trajectoryId,
                analysisId: source.analysisId,
                exposureId: source.exposureId,
                timestep: currentTimestep,
                style
            });

            setCategoryCounts(response.categoryCounts);

            const styledScene: LineStyleScene = {
                sceneType: 'line-style',
                source: 'line-style',
                analysisId: source.analysisId,
                exposureId: source.exposureId,
                style
            };

            const replaced = activeScenes.filter((scene) => (
                isLineStyleScene(scene)
                || (isLineSource(scene) && scene.exposureId === source.exposureId)
            ));
            if (replaced.length > 0) {
                replaced.forEach((scene) => removeScene(scene));
                addScene(styledScene);
            } else {
                setActiveScene(styledScene);
            }

            window.dispatchEvent(new CustomEvent('canvas:scene-artifacts:changed', {
                detail: { trajectoryId }
            }));
        } catch (applyError: unknown) {
            setError(reportError(applyError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to style line entities'
            }).title);
        } finally {
            setIsApplying(false);
        }
    }, [trajectoryId, currentTimestep, source, buildStyle, activeScenes, removeScene, addScene, setActiveScene]);

    const [entityIdInput, setEntityIdInput] = useState('');
    const [inspectedEntity, setInspectedEntity] = useState<InspectedLineEntity | null>(null);
    const [isInspecting, setIsInspecting] = useState(false);
    const [inspectError, setInspectError] = useState<string | null>(null);

    const handleInspect = useCallback(async () => {
        if (!trajectoryId || currentTimestep === undefined || !source) {
            setInspectError('Add a line result to the scene first');
            return;
        }

        const entityId = Number(entityIdInput);
        if (entityIdInput.trim() === '' || !Number.isFinite(entityId)) {
            setInspectError('Enter a numeric entity id');
            return;
        }

        setInspectError(null);
        setIsInspecting(true);
        try {
            const response = await lineStyleService.getEntityProperties({
                trajectoryId,
                analysisId: source.analysisId,
                exposureId: source.exposureId,
                timestep: currentTimestep,
                entityId
            });
            setInspectedEntity(response);
        } catch (lookupError: unknown) {
            setInspectedEntity(null);
            setInspectError(reportError(lookupError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: `Entity ${entityId} not found`
            }).title);
        } finally {
            setIsInspecting(false);
        }
    }, [trajectoryId, currentTimestep, source, entityIdInput]);

    return {
        hasLineSource: Boolean(source),
        isLoadingProperties,
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
        isFetchingStats: statsQuery.isFetching,
        filterRows,
        addFilterRow,
        removeFilterRow,
        updateFilterRow,
        lineWidthInput,
        setLineWidthInput,
        isApplying,
        handleApply,
        error,
        entityIdInput,
        setEntityIdInput,
        handleInspect,
        isInspecting,
        inspectedEntity,
        inspectError
    };
};

export default useLineStyle;
