export interface ResolvedLocalGlbManifestFrame {
    url: string;
    label?: string;
    timestep?: number;
}

export interface ResolvedLocalGlbManifest {
    title?: string;
    initialFrame: number;
    frames: ResolvedLocalGlbManifestFrame[];
}

/**
 * Shape written by our own ClusterDaemon (and by the manifests we hand-author
 * for local previews). Declared once here; downstream code trusts it.
 */
interface LocalGlbManifestDocument {
    title?: string;
    initialFrame?: number;
    frames: ResolvedLocalGlbManifestFrame[];
}

export const clampFrameIndex = (value: number, frameCount: number): number => {
    if (frameCount <= 0 || !Number.isFinite(value)) {
        return 0;
    }

    return Math.max(0, Math.min(frameCount - 1, Math.floor(value)));
};

export const resolveLocalGlbUrl = (value: string): string => {
    return new URL(value, window.location.href).toString();
};

/**
 * Frame urls are stored relative to the manifest, so they are rebased onto it;
 * everything else is passed through as declared.
 */
export const fetchLocalGlbManifest = async (
    manifestUrl: string,
    signal?: AbortSignal
): Promise<ResolvedLocalGlbManifest> => {
    const response = await fetch(manifestUrl, { signal });
    if (!response.ok) {
        throw new Error(`Manifest request failed with status ${response.status}.`);
    }

    const manifest = await response.json() as LocalGlbManifestDocument;
    const frames = manifest.frames.map((frame) => ({
        ...frame,
        url: new URL(frame.url, manifestUrl).toString()
    }));

    return {
        title: manifest.title,
        initialFrame: clampFrameIndex(manifest.initialFrame ?? 0, frames.length),
        frames
    };
};
