import { useLocalGlbStore } from '@/modules/canvas/store/use-local-glb-store';
import { clampFrameIndex, fetchLocalGlbManifest, resolveLocalGlbUrl } from '@/modules/canvas/utils/local-glb-manifest';
import useCanvasUrlState from '../../hooks/use-canvas-url-state';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ResolvedLocalGlbManifest } from '@/modules/canvas/utils/local-glb-manifest';

const useLocalGlbViewer = (enabled: boolean) => {
    const { searchParams, updateSearchParams } = useCanvasUrlState();
    const localGlbUrl = useLocalGlbStore((state) => state.localGlbUrl);
    const clearLocalGlb = useLocalGlbStore((state) => state.clearLocalGlb);
    const [manifest, setManifest] = useState<ResolvedLocalGlbManifest | null>(null);
    const [manifestError, setManifestError] = useState<string | null>(null);
    const [isManifestLoading, setIsManifestLoading] = useState(false);

    const manifestUrl = enabled ? searchParams.get('manifest')?.trim() || null : null;
    const rawQueryGlbUrl = enabled ? searchParams.get('url')?.trim() || null : null;
    const queryGlbUrl = rawQueryGlbUrl ? resolveLocalGlbUrl(rawQueryGlbUrl) : null;

    useEffect(() => {
        if (!manifestUrl) {
            setManifest(null);
            setManifestError(null);
            setIsManifestLoading(false);
            return;
        }

        const abortController = new AbortController();
        setIsManifestLoading(true);
        setManifest(null);
        setManifestError(null);

        fetchLocalGlbManifest(resolveLocalGlbUrl(manifestUrl), abortController.signal)
            .then(setManifest)
            .catch((error: unknown) => {
                if (abortController.signal.aborted) {
                    return;
                }

                setManifestError(error instanceof Error ? error.message : 'Unexpected manifest error.');
            })
            .finally(() => {
                if (!abortController.signal.aborted) {
                    setIsManifestLoading(false);
                }
            });

        return () => {
            abortController.abort();
        };
    }, [manifestUrl]);

    const wasEnabledRef = useRef(enabled);
    useEffect(() => {
        if (wasEnabledRef.current && !enabled) {
            clearLocalGlb();
        }

        wasEnabledRef.current = enabled;
    }, [clearLocalGlb, enabled]);

    const requestedFrame = Number(searchParams.get('frame'));
    const frameIndex = Number.isFinite(requestedFrame)
        ? clampFrameIndex(requestedFrame, manifest?.frames.length ?? 0)
        : manifest?.initialFrame ?? 0;
    const frame = manifest?.frames[frameIndex] ?? null;

    const setFrameIndex = useCallback((nextIndex: number) => {
        if (!manifest) {
            return;
        }

        updateSearchParams({ frame: clampFrameIndex(nextIndex, manifest.frames.length) }, { replace: true });
    }, [manifest, updateSearchParams]);

    return {
        manifest,
        manifestError,
        isManifestLoading,
        frame,
        frameIndex,
        setFrameIndex,
        forcedGlbUrl: enabled
            ? frame?.url ?? queryGlbUrl ?? localGlbUrl
            : null
    };
};

export default useLocalGlbViewer;
