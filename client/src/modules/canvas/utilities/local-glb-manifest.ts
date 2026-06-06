export interface LocalGlbManifestFrame {
    url: string;
    label?: string;
    timestep?: number;
}

export interface LocalGlbManifest {
    title?: string;
    initialFrame?: number;
    frames: LocalGlbManifestFrame[];
}

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

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

export const clampFrameIndex = (value: number, frameCount: number): number => {
    if (frameCount <= 0) {
        return 0;
    }

    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(0, Math.min(frameCount - 1, Math.floor(value)));
};

export const resolveLocalGlbUrl = (value: string): string => {
    return new URL(value, window.location.href).toString();
};

export const fetchLocalGlbManifest = async (
    manifestUrl: string,
    signal?: AbortSignal,
): Promise<ResolvedLocalGlbManifest> => {
    const response = await fetch(manifestUrl, { signal });
    if (!response.ok) {
        throw new Error(`Manifest request failed with status ${response.status}.`);
    }

    const payload = await response.json() as unknown;
    if (!isRecord(payload)) {
        throw new Error('Manifest must be a JSON object.');
    }

    const rawFrames = payload.frames;
    if (!Array.isArray(rawFrames) || rawFrames.length === 0) {
        throw new Error('Manifest must include a non-empty frames array.');
    }

    const frames = rawFrames.map((frame, index) => {
        if (!isRecord(frame) || typeof frame.url !== 'string' || frame.url.trim().length === 0) {
            throw new Error(`Manifest frame ${index} is missing a valid url.`);
        }

        return {
            url: new URL(frame.url, manifestUrl).toString(),
            label: typeof frame.label === 'string' && frame.label.trim().length > 0
                ? frame.label
                : undefined,
            timestep: typeof frame.timestep === 'number' && Number.isFinite(frame.timestep)
                ? frame.timestep
                : undefined
        } satisfies ResolvedLocalGlbManifestFrame;
    });

    const requestedInitialFrame = typeof payload.initialFrame === 'number'
        ? payload.initialFrame
        : 0;

    return {
        title: typeof payload.title === 'string' && payload.title.trim().length > 0
            ? payload.title
            : undefined,
        initialFrame: clampFrameIndex(requestedInitialFrame, frames.length),
        frames
    };
};
