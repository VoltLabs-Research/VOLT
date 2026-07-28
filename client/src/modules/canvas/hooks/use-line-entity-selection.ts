import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { lineModelRangesQuery } from '@/modules/trajectory/hooks/line-style/queries';
import { getSceneKey, resolveLineSceneSource } from '@/modules/fractal/utils/scene-utils';
import { ErrorSurface, reportError } from '@/shared/errors/core';

import type { SceneObjectType } from '@/modules/fractal/contracts/scene';
import type { LineEntityHighlight } from '@/modules/fractal/contracts/scene-config';
import type { ListingRow } from '@volt/contracts/modules/plugin/domain/listing';

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
