import {
    invalidateSceneArtifacts,
    sceneArtifactsQuery
} from '@/modules/trajectory/hooks/scene-artifacts/queries';
import { toSceneObjectFromArtifact } from '@/modules/canvas/utils/scene-identity';
import { useEffect, useMemo } from 'react';

import type { SceneArtifact } from '@volt/contracts/modules/trajectory/domain';
import type { RenderableExposurePayload } from '@/modules/trajectory/api/services/scene-artifacts-service';

interface UseSceneArtifactsOptions {
    trajectoryId?: string;
}

const isSceneArtifact = (
    item: SceneArtifact | RenderableExposurePayload
): item is SceneArtifact => 'sourceType' in item;

const isSupportedParticleFilterArtifact = (artifact: SceneArtifact): boolean => {
    return toSceneObjectFromArtifact(artifact)?.source === 'particle-filter';
};

const useSceneArtifacts = ({ trajectoryId }: UseSceneArtifactsOptions) => {
    const colorCodingQuery = sceneArtifactsQuery(
        {
            trajectoryId: trajectoryId ?? '',
            sourceType: 'color-coding',
            page: 1,
            limit: 200
        },
        { enabled: !!trajectoryId }
    );

    const particleFilterQuery = sceneArtifactsQuery(
        {
            trajectoryId: trajectoryId ?? '',
            sourceType: 'particle-filter',
            page: 1,
            limit: 200
        },
        { enabled: !!trajectoryId }
    );

    const colorCodingArtifacts = useMemo(() => {
        if (!colorCodingQuery.data) return [];
        return colorCodingQuery.data.data.filter(isSceneArtifact);
    }, [colorCodingQuery.data]);

    const particleFilterArtifacts = useMemo(() => {
        if (!particleFilterQuery.data) return [];
        return particleFilterQuery.data.data
            .filter(isSceneArtifact)
            .filter(isSupportedParticleFilterArtifact);
    }, [particleFilterQuery.data]);

    const isLoading = colorCodingQuery.isLoading || particleFilterQuery.isLoading;

    useEffect(() => {
        const onArtifactsChanged = (event: Event) => {
            const customEvent = event as CustomEvent<{ trajectoryId?: string }>;
            if (customEvent.detail?.trajectoryId && customEvent.detail.trajectoryId !== trajectoryId) return;
            void invalidateSceneArtifacts();
        };

        window.addEventListener('canvas:scene-artifacts:changed', onArtifactsChanged);
        return () => {
            window.removeEventListener('canvas:scene-artifacts:changed', onArtifactsChanged);
        };
    }, [trajectoryId]);

    return {
        isLoading,
        colorCodingArtifacts,
        particleFilterArtifacts
    };
};

export default useSceneArtifacts;
