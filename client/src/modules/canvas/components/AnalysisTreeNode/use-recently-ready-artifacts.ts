import { useEffect, useRef, useState } from 'react';

import type { AnalysisArtifactStatus, AnalysisExpectedArtifact } from '@volt/contracts/modules/analysis/domain';

const READY_ARTIFACT_HIGHLIGHT_MS = 1400;

/**
 * Tracks artifacts that just finished so the tree can flash them briefly. An
 * artifact is highlighted only when this hook observed it move into `ready`,
 * so artifacts already ready on mount stay quiet. A highlight and its removal
 * timer are always created and cleared together, which makes the live timers
 * an exact mirror of the highlighted ids.
 */
const useRecentlyReadyArtifacts = (
    expectedArtifacts: AnalysisExpectedArtifact[] | undefined
): ReadonlySet<string> => {
    const [recentlyReadyIds, setRecentlyReadyIds] = useState<ReadonlySet<string>>(() => new Set());
    const previousStatusesRef = useRef<Map<string, AnalysisArtifactStatus>>(new Map());
    const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    useEffect(() => {
        const previousStatuses = previousStatusesRef.current;
        const timers = timersRef.current;
        const currentStatuses = new Map(
            (expectedArtifacts ?? []).map((artifact) => [artifact.exposureId, artifact.status])
        );
        previousStatusesRef.current = currentStatuses;

        const highlighted: string[] = [];
        const expired: string[] = [];

        currentStatuses.forEach((status, artifactId) => {
            const previousStatus = previousStatuses.get(artifactId);
            if (status !== 'ready') {
                if (timers.has(artifactId)) expired.push(artifactId);
            } else if (previousStatus && previousStatus !== 'ready') {
                highlighted.push(artifactId);
            }
        });

        for (const artifactId of timers.keys()) {
            if (!currentStatuses.has(artifactId)) expired.push(artifactId);
        }

        if (highlighted.length === 0 && expired.length === 0) return;

        expired.forEach((artifactId) => {
            const timer = timers.get(artifactId);
            timers.delete(artifactId);
            clearTimeout(timer);
        });

        highlighted.forEach((artifactId) => {
            timers.set(artifactId, setTimeout(() => {
                timers.delete(artifactId);
                setRecentlyReadyIds((current) => {
                    const next = new Set(current);
                    next.delete(artifactId);
                    return next;
                });
            }, READY_ARTIFACT_HIGHLIGHT_MS));
        });

        setRecentlyReadyIds((current) => {
            const next = new Set(current);
            expired.forEach((artifactId) => next.delete(artifactId));
            highlighted.forEach((artifactId) => next.add(artifactId));
            return next;
        });
    }, [expectedArtifacts]);

    useEffect(() => {
        const timers = timersRef.current;
        return () => {
            timers.forEach(clearTimeout);
            timers.clear();
        };
    }, []);

    return recentlyReadyIds;
};

export default useRecentlyReadyArtifacts;
