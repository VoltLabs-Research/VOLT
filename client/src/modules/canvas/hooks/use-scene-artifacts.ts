import {
    invalidateSceneArtifacts,
    sceneArtifactsQuery
} from '@/modules/trajectory/hooks/scene-artifacts/queries';
import { toSceneObjectFromArtifact } from '@/modules/canvas/utilities/scene-identity';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import { useEffect, useMemo } from 'react';

import type { SceneArtifact } from '@/modules/trajectory/api/types/scene-artifacts/scene-artifact';

interface UseSceneArtifactsOptions {
    trajectoryId?: string;
}

const isSceneArtifact = (item: unknown): item is SceneArtifact => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Record<string, unknown>;
    return typeof candidate._id === 'string' && typeof candidate.sourceType === 'string';
};

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

    const lineStyleQuery = sceneArtifactsQuery(
        {
            trajectoryId: trajectoryId ?? '',
            sourceType: 'line-style',
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

    const lineStyleArtifacts = useMemo(() => {
        if (!lineStyleQuery.data) return [];
        return lineStyleQuery.data.data.filter(isSceneArtifact);
    }, [lineStyleQuery.data]);

    const isLoading = colorCodingQuery.isLoading || particleFilterQuery.isLoading || lineStyleQuery.isLoading;

    const error = useMemo(() => {
        const queryError = colorCodingQuery.error || particleFilterQuery.error || lineStyleQuery.error;
        if (!queryError) return null;
        return reportError(queryError, {
            surface: ErrorSurface.Silent,
            fallbackTitle: 'Failed to load scene artifacts'
        }).title;
    }, [colorCodingQuery.error, particleFilterQuery.error, lineStyleQuery.error]);

    const accessDenied = useMemo(() => {
        return isAccessDeniedError(colorCodingQuery.error)
            || isAccessDeniedError(particleFilterQuery.error)
            || isAccessDeniedError(lineStyleQuery.error);
    }, [colorCodingQuery.error, particleFilterQuery.error, lineStyleQuery.error]);

    const accessDeniedMessage = useMemo(() => {
        const firstAccessDeniedError = [colorCodingQuery.error, particleFilterQuery.error, lineStyleQuery.error]
            .find((queryError) => isAccessDeniedError(queryError));
        if (!firstAccessDeniedError) {
            return undefined;
        }

        return reportError(firstAccessDeniedError, { surface: ErrorSurface.Silent }).title;
    }, [colorCodingQuery.error, particleFilterQuery.error, lineStyleQuery.error]);

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

    const totalArtifacts = useMemo(
        () => colorCodingArtifacts.length + particleFilterArtifacts.length + lineStyleArtifacts.length,
        [colorCodingArtifacts.length, particleFilterArtifacts.length, lineStyleArtifacts.length]
    );

    const reload = () => {
        void invalidateSceneArtifacts();
    };

    return {
        isLoading,
        error,
        accessDenied,
        accessDeniedMessage,
        totalArtifacts,
        colorCodingArtifacts,
        particleFilterArtifacts,
        lineStyleArtifacts,
        reload
    };
};

export default useSceneArtifacts;
