import useModifierBase from './use-modifier-base';
import dislocationStyleService from '@/modules/trajectory/api/services/dislocation-style-service';
import { ErrorSurface, reportError } from '@/shared/errors/core';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type {
    DislocationStyleScene,
    DislocationStyleSpec,
    PluginScene,
    SceneObjectType
} from '@/modules/fractal/api/entities/scene';
import type { DislocationFamilySummary } from '@/modules/trajectory/api/services/dislocation-style-service';
import type { ColormapName } from '@/modules/fractal/services/colormaps';
import type { UseModifierBaseOptions } from './use-modifier-base';

export type DislocationColorMode = NonNullable<DislocationStyleSpec['colorMode']>;
export type DislocationColorProperty = NonNullable<DislocationStyleSpec['property']>;

export interface DislocationFamilyOption {
    family: string;
    label: string;
    swatch: string;
}

// Mirrors the daemon's OVITO-parity palette (dislocation-exporter
// DISLOCATION_TYPE_COLORS) so the panel swatches match the rendered tubes.
export const DISLOCATION_FAMILY_CATALOG: DislocationFamilyOption[] = [
    { family: '1/2<110>', label: '1/2<110> (Perfect)', swatch: '#3333ff' },
    { family: '1/6<112>', label: '1/6<112> (Shockley)', swatch: '#00ff00' },
    { family: '1/6<110>', label: '1/6<110> (Stair-rod)', swatch: '#ff00ff' },
    { family: '1/3<100>', label: '1/3<100> (Hirth)', swatch: '#ffff00' },
    { family: '1/3<111>', label: '1/3<111> (Frank)', swatch: '#00ffff' },
    { family: '1/2<111>', label: '1/2<111> (Perfect)', swatch: '#33f233' },
    { family: '<100>', label: '<100>', swatch: '#ff4dcc' },
    { family: '<110>', label: '<110>', swatch: '#3380ff' },
    { family: '<111>', label: '<111>', swatch: '#ffcc33' },
    { family: '1/3<1-210>', label: '1/3<1-210> (Perfect basal)', swatch: '#00ff00' },
    { family: '1/3<1-100>', label: '1/3<1-100> (Shockley)', swatch: '#ff00ff' },
    { family: '<0001>', label: '<0001> (Perfect c)', swatch: '#ff4dcc' },
    { family: '1/2<0001>', label: '1/2<0001> (Partial c)', swatch: '#ffff00' },
    { family: '1/3<1-213>', label: '1/3<1-213> (Perfect c+a)', swatch: '#00ffff' },
    { family: 'Other', label: 'Other', swatch: '#e63333' }
];

const isDislocationSource = (scene: SceneObjectType): scene is PluginScene => {
    return scene.source === 'plugin'
        && scene.sceneRenderMetadata?.exporter === 'DislocationExporter';
};

const isDislocationStyleScene = (scene: SceneObjectType): scene is DislocationStyleScene => {
    return scene.source === 'dislocation-style';
};

const hexToRgba = (hex: string): [number, number, number, number] => {
    const normalized = hex.replace('#', '');
    const red = parseInt(normalized.slice(0, 2), 16) / 255;
    const green = parseInt(normalized.slice(2, 4), 16) / 255;
    const blue = parseInt(normalized.slice(4, 6), 16) / 255;
    return [red, green, blue, 1];
};

const useDislocationStyle = (options: UseModifierBaseOptions = {}) => {
    const {
        trajectoryId,
        analysisId,
        currentTimestep,
        setActiveScene
    } = useModifierBase(options);

    const { activeScenes, addScene, removeScene } = useEditorStore(useShallow((state) => ({
        activeScenes: state.activeScenes,
        addScene: state.addScene,
        removeScene: state.removeScene
    })));

    // The restyle source is whichever dislocation scene is already in the
    // viewport — the baked plugin exposure or a previously styled scene.
    const source = useMemo(() => {
        const styledScene = activeScenes.find(isDislocationStyleScene);
        if (styledScene) {
            return { analysisId: styledScene.analysisId, exposureId: styledScene.exposureId };
        }

        const pluginScene = activeScenes.find(isDislocationSource);
        if (pluginScene) {
            return { analysisId: pluginScene.analysisId, exposureId: pluginScene.exposureId };
        }

        return null;
    }, [activeScenes]);

    const [hiddenFamilies, setHiddenFamilies] = useState<Record<string, boolean>>({});
    const [colorMode, setColorMode] = useState<DislocationColorMode>('family');
    const [uniformColorHex, setUniformColorHex] = useState('#ff8000');
    const [property, setProperty] = useState<DislocationColorProperty>('length');
    const [gradient, setGradient] = useState<ColormapName>('Jet');
    const [lineWidthInput, setLineWidthInput] = useState('');
    const [minLengthInput, setMinLengthInput] = useState('');
    const [familyCounts, setFamilyCounts] = useState<Record<string, DislocationFamilySummary> | null>(null);
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleFamily = useCallback((family: string) => {
        setHiddenFamilies((current) => ({ ...current, [family]: !current[family] }));
    }, []);

    const familyOptions = useMemo(() => {
        if (!familyCounts) {
            return DISLOCATION_FAMILY_CATALOG;
        }

        // After the first apply we know which families actually exist in the
        // frame, so the catalog collapses to those (plus their real counts).
        const present = new Set(Object.keys(familyCounts));
        const known = DISLOCATION_FAMILY_CATALOG.filter((option) => present.has(option.family));
        const unknown = [...present]
            .filter((family) => !DISLOCATION_FAMILY_CATALOG.some((option) => option.family === family))
            .map((family) => ({ family, label: family, swatch: '#999999' }));
        return [...known, ...unknown];
    }, [familyCounts]);

    const buildStyle = useCallback((): DislocationStyleSpec => {
        const style: DislocationStyleSpec = { colorMode };

        const hidden = Object.entries(hiddenFamilies).filter(([, isHidden]) => isHidden);
        if (hidden.length > 0) {
            style.familyVisibility = Object.fromEntries(hidden.map(([family]) => [family, false]));
        }

        if (colorMode === 'uniform') {
            style.uniformColor = hexToRgba(uniformColorHex);
        }

        if (colorMode === 'property') {
            style.property = property;
            style.gradient = gradient;
        }

        const lineWidth = Number(lineWidthInput);
        if (lineWidthInput.trim() !== '' && Number.isFinite(lineWidth) && lineWidth > 0) {
            style.lineWidth = lineWidth;
        }

        const minLength = Number(minLengthInput);
        if (minLengthInput.trim() !== '' && Number.isFinite(minLength) && minLength > 0) {
            style.minLength = minLength;
        }

        return style;
    }, [colorMode, hiddenFamilies, uniformColorHex, property, gradient, lineWidthInput, minLengthInput]);

    const handleApply = useCallback(async () => {
        if (!trajectoryId || currentTimestep === undefined || !source) {
            setError('Add a Dislocations result to the scene first');
            return;
        }

        setError(null);
        setIsApplying(true);
        try {
            const style = buildStyle();
            const response = await dislocationStyleService.apply({
                trajectoryId,
                analysisId: source.analysisId,
                exposureId: source.exposureId,
                timestep: currentTimestep,
                style
            });

            setFamilyCounts(response.familyCounts);

            const styledScene: DislocationStyleScene = {
                sceneType: 'dislocation-style',
                source: 'dislocation-style',
                analysisId: source.analysisId,
                exposureId: source.exposureId,
                style
            };

            // Swap the unstyled tubes (or the previous style) for the new
            // model while leaving every other composed scene untouched.
            const replaced = activeScenes.filter((scene) => (
                isDislocationStyleScene(scene)
                || (isDislocationSource(scene) && scene.exposureId === source.exposureId)
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
                fallbackTitle: 'Failed to style dislocations'
            }).title);
        } finally {
            setIsApplying(false);
        }
    }, [trajectoryId, currentTimestep, source, buildStyle, activeScenes, removeScene, addScene, setActiveScene]);

    return {
        hasDislocationSource: Boolean(source),
        analysisId,
        familyOptions,
        familyCounts,
        hiddenFamilies,
        toggleFamily,
        colorMode,
        setColorMode,
        uniformColorHex,
        setUniformColorHex,
        property,
        setProperty,
        gradient,
        setGradient,
        lineWidthInput,
        setLineWidthInput,
        minLengthInput,
        setMinLengthInput,
        isApplying,
        handleApply,
        error
    };
};

export default useDislocationStyle;
