import { useCallback, useEffect, useMemo, useState } from 'react';
import { sileo } from 'sileo';
import useSceneArtifactUseCases from '@/modules/trajectory/presentation/hooks/generated-scenes/use-scene-artifact-services';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import type { SceneArtifact } from '@/modules/trajectory/domain/entities/SceneArtifact';

interface UseSceneArtifactsOptions {
    trajectoryId?: string;
}

const isSceneArtifact = (item: unknown): item is SceneArtifact => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Record<string, unknown>;
    return typeof candidate._id === 'string' && typeof candidate.sourceType === 'string';
};

const useSceneArtifacts = ({ trajectoryId }: UseSceneArtifactsOptions) => {
    const { listSceneArtifactsUseCase } = useSceneArtifactUseCases();
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [colorCodingArtifacts, setColorCodingArtifacts] = useState<SceneArtifact[]>([]);
    const [particleFilterArtifacts, setParticleFilterArtifacts] = useState<SceneArtifact[]>([]);

    const loadArtifacts = useCallback(async () => {
        if (!trajectoryId) {
            setColorCodingArtifacts([]);
            setParticleFilterArtifacts([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const [colorCoding, particleFilter] = await Promise.all([
                listSceneArtifactsUseCase.execute({
                    trajectoryId,
                    sourceType: 'color-coding',
                    page: 1,
                    limit: 200
                }),
                listSceneArtifactsUseCase.execute({
                    trajectoryId,
                    sourceType: 'particle-filter',
                    page: 1,
                    limit: 200
                })
            ]);

            setColorCodingArtifacts(colorCoding.data.filter(isSceneArtifact));
            setParticleFilterArtifacts(particleFilter.data.filter(isSceneArtifact));
        } catch (err: any) {
            if(checkRBACError(err)) return;
            setError(err?.message || 'Failed to load scene artifacts');
            sileo.error({ title: 'Failed to load scene artifacts' });
            setColorCodingArtifacts([]);
            setParticleFilterArtifacts([]);
        } finally {
            setIsLoading(false);
        }
    }, [trajectoryId, listSceneArtifactsUseCase]);

    useEffect(() => {
        loadArtifacts();
    }, [loadArtifacts]);

    useEffect(() => {
        const onArtifactsChanged = (event: Event) => {
            const customEvent = event as CustomEvent<{ trajectoryId?: string }>;
            if (customEvent.detail?.trajectoryId && customEvent.detail.trajectoryId !== trajectoryId) return;
            loadArtifacts();
        };

        window.addEventListener('canvas:scene-artifacts:changed', onArtifactsChanged);
        return () => {
            window.removeEventListener('canvas:scene-artifacts:changed', onArtifactsChanged);
        };
    }, [trajectoryId, loadArtifacts]);

    const totalArtifacts = useMemo(() => colorCodingArtifacts.length + particleFilterArtifacts.length, [
        colorCodingArtifacts.length,
        particleFilterArtifacts.length
    ]);

    return {
        isLoading,
        error,
        accessDenied,
        accessDeniedMessage,
        totalArtifacts,
        colorCodingArtifacts,
        particleFilterArtifacts,
        reload: loadArtifacts
    };
};

export default useSceneArtifacts;
