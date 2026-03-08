import { useEffect, useMemo } from 'react';
import { sceneArtifactsQuery } from '@/modules/trajectory/hooks/scene-artifact/queries';
import { TRAJECTORY_QUERY_KEYS } from '@/modules/trajectory/hooks/trajectory/queries';
import queryClient from '@/shared/infrastructure/query/query-client';
import ApiError from '@/shared/errors/ApiError';
import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifact';

interface UseSceneArtifactsOptions {
    trajectoryId?: string;
}

const isSceneArtifact = (item: unknown): item is SceneArtifact => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Record<string, unknown>;
    return typeof candidate._id === 'string' && typeof candidate.sourceType === 'string';
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
        return particleFilterQuery.data.data.filter(isSceneArtifact);
    }, [particleFilterQuery.data]);

    const isLoading = colorCodingQuery.isLoading || particleFilterQuery.isLoading;

    const error = useMemo(() => {
        const queryError = colorCodingQuery.error || particleFilterQuery.error;
        if (!queryError) return null;
        if (queryError instanceof Error) return queryError.message;
        return 'Failed to load scene artifacts';
    }, [colorCodingQuery.error, particleFilterQuery.error]);

    const accessDenied = useMemo(() => {
        return ApiError.isRBACError(colorCodingQuery.error) || ApiError.isRBACError(particleFilterQuery.error);
    }, [colorCodingQuery.error, particleFilterQuery.error]);

    const accessDeniedMessage = useMemo(() => {
        const rbacError = [colorCodingQuery.error, particleFilterQuery.error].find(
            (queryError) => queryError && ApiError.isRBACError(queryError)
        );
        if (rbacError instanceof ApiError) {
            return rbacError.getFriendlyMessage();
        }
        return undefined;
    }, [colorCodingQuery.error, particleFilterQuery.error]);

    useEffect(() => {
        const onArtifactsChanged = (event: Event) => {
            const customEvent = event as CustomEvent<{ trajectoryId?: string }>;
            if (customEvent.detail?.trajectoryId && customEvent.detail.trajectoryId !== trajectoryId) return;
            void queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.sceneArtifacts() });
        };

        window.addEventListener('canvas:scene-artifacts:changed', onArtifactsChanged);
        return () => {
            window.removeEventListener('canvas:scene-artifacts:changed', onArtifactsChanged);
        };
    }, [trajectoryId]);

    const totalArtifacts = useMemo(
        () => colorCodingArtifacts.length + particleFilterArtifacts.length,
        [colorCodingArtifacts.length, particleFilterArtifacts.length]
    );

    const reload = () => {
        void queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.sceneArtifacts() });
    };

    return {
        isLoading,
        error,
        accessDenied,
        accessDeniedMessage,
        totalArtifacts,
        colorCodingArtifacts,
        particleFilterArtifacts,
        reload
    };
};

export default useSceneArtifacts;
