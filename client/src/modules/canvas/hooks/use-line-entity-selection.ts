import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { lineModelRangesQuery } from '@/modules/trajectory/hooks/line-style/queries';
import { getSceneKey, resolveLineSceneSource } from '@/modules/fractal/utilities/scene-utils';
import { ErrorSurface, reportError } from '@/shared/errors/core';

import type { SceneObjectType } from '@/modules/fractal/api/entities/scene';
import type { LineEntityHighlight } from '@/modules/fractal/types/scene-config';
import type { ListingRow } from '@/modules/plugin/api/entities/listing/listing-row';

// Row interaction for a line exposure's listing: clicking a row toggles that
// line entity's selection so the viewport highlights the matching tube. The
// handlers are undefined while no scene renders the exposure.
export const useLineEntityRowSelection = (exposureId: string | null | undefined) => {
    const { activeScenes, selection, toggleLineEntitySelection } = useEditorStore(useShallow((state) => ({
        activeScenes: state.activeScenes,
        selection: state.lineEntitySelection,
        toggleLineEntitySelection: state.toggleLineEntitySelection
    })));

    const enabled = useMemo(() => (
        Boolean(exposureId)
        && activeScenes.some((scene) => resolveLineSceneSource(scene)?.exposureId === exposureId)
    ), [activeScenes, exposureId]);

    const onRowClick = useCallback((row: ListingRow) => {
        const entityId = Number(row.id);
        if (!exposureId || !Number.isFinite(entityId)) return;
        toggleLineEntitySelection({ exposureId, entityId });
    }, [exposureId, toggleLineEntitySelection]);

    const isRowSelected = useCallback((row: ListingRow) => (
        selection !== null
        && selection.exposureId === exposureId
        && selection.entityId === Number(row.id)
    ), [exposureId, selection]);

    return {
        onRowClick: enabled ? onRowClick : undefined,
        isRowSelected: enabled ? isRowSelected : undefined
    };
};

// Reverse picking: a click on a line tube reports the triangle it hit;
// resolving it against the ranges sidecar yields the entity to toggle. Shares
// the highlight query's cache, so the lookup is local after the first fetch.
export const useLineEntityPick = (
    trajectoryId: string | undefined,
    currentTimestep: number | undefined
) => {
    const toggleLineEntitySelection = useEditorStore((state) => state.toggleLineEntitySelection);

    return useCallback(async (scene: SceneObjectType, faceIndex: number) => {
        const source = resolveLineSceneSource(scene);
        if (!source || !trajectoryId || currentTimestep === undefined) return;

        try {
            const ranges = await lineModelRangesQuery.fetch({
                trajectoryId,
                analysisId: source.analysisId,
                exposureId: source.exposureId,
                timestep: currentTimestep,
                ...(source.style ? { style: source.style } : {})
            }, { staleTime: Infinity });

            const entity = ranges.entities.find((candidate) => (
                faceIndex >= candidate.triangleStart
                && faceIndex < candidate.triangleStart + candidate.triangleCount
            ));
            if (!entity) return;

            toggleLineEntitySelection({ exposureId: source.exposureId, entityId: entity.id });
        } catch (pickError: unknown) {
            reportError(pickError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to resolve picked line entity'
            });
        }
    }, [trajectoryId, currentTimestep, toggleLineEntitySelection]);
};

// Resolves the current line entity selection to the scene that renders it plus
// the GLB's triangle-range sidecar, ready for the engine's highlight pass.
export const useLineEntityHighlight = (
    trajectoryId: string | undefined,
    currentTimestep: number | undefined
): LineEntityHighlight | undefined => {
    const { activeScenes, selection } = useEditorStore(useShallow((state) => ({
        activeScenes: state.activeScenes,
        selection: state.lineEntitySelection
    })));

    const source = useMemo(() => {
        if (!selection) return null;
        for (const scene of activeScenes) {
            const candidate = resolveLineSceneSource(scene);
            if (candidate?.exposureId === selection.exposureId) return candidate;
        }
        return null;
    }, [activeScenes, selection]);

    const rangesParams = useMemo(() => {
        if (!trajectoryId || currentTimestep === undefined || !source) return null;
        return {
            trajectoryId,
            analysisId: source.analysisId,
            exposureId: source.exposureId,
            timestep: currentTimestep,
            ...(source.style ? { style: source.style } : {})
        };
    }, [trajectoryId, currentTimestep, source]);

    const rangesResult = lineModelRangesQuery(
        rangesParams ?? { trajectoryId: '', analysisId: '', exposureId: '', timestep: 0 },
        {
            enabled: Boolean(rangesParams),
            retry: false,
            // The sidecar is immutable per (analysis, exposure, timestep, style).
            staleTime: Infinity
        }
    );

    return useMemo(() => {
        if (!selection || !source || !rangesResult.data) return undefined;
        return {
            sceneKey: getSceneKey(source.scene),
            entityId: selection.entityId,
            entityRanges: rangesResult.data.entities
        };
    }, [selection, source, rangesResult.data]);
};
