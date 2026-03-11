type WriteCallback = (error?: Error | null) => void;

interface DuplicateGuardState {
    lastChunk: string;
    lastAt: number;
}

const DEFAULT_DUPLICATE_WINDOW_MS = 250;

const readDuplicateWindowMs = (): number => {
    const rawValue = process.env.LOG_DUPLICATE_WINDOW_MS?.trim();

    if (!rawValue) {
        return DEFAULT_DUPLICATE_WINDOW_MS;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value) || value < 0) {
        throw new Error('LOG_DUPLICATE_WINDOW_MS must be zero or a positive number');
    }

    return value;
};

const toChunkString = (chunk: Uint8Array | string, encoding?: BufferEncoding): string => {
    if (typeof chunk === 'string') {
        return chunk;
    }

    return Buffer.from(chunk).toString(encoding);
};

const installGuardForStream = (
    stream: NodeJS.WriteStream,
    windowMs: number,
    state: DuplicateGuardState
): void => {
    const originalWrite = stream.write.bind(stream) as typeof stream.write;

    stream.write = ((chunk: Uint8Array | string, arg2?: BufferEncoding | WriteCallback, arg3?: WriteCallback) => {
        const callback = typeof arg2 === 'function'
            ? arg2
            : typeof arg3 === 'function'
                ? arg3
                : undefined;

        const encoding = typeof arg2 === 'string'
            ? arg2
            : undefined;

        const chunkText = toChunkString(chunk, encoding);
        const now = Date.now();
        const isDuplicate = chunkText.length > 0
            && chunkText === state.lastChunk
            && now - state.lastAt <= windowMs;

        if (isDuplicate) {
            callback?.();
            return true;
        }

        state.lastChunk = chunkText;
        state.lastAt = now;

        if (typeof arg2 === 'function') {
            return originalWrite(chunk, arg2);
        }

        if (typeof arg2 === 'string') {
            return originalWrite(chunk, arg2, arg3);
        }

        return originalWrite(chunk, callback);
    }) as typeof stream.write;
};

const installOutputDuplicateGuard = (): void => {
    const windowMs = readDuplicateWindowMs();

    if (windowMs === 0) {
        return;
    }

    const stdoutState: DuplicateGuardState = {
        lastChunk: '',
        lastAt: 0
    };
    const stderrState: DuplicateGuardState = {
        lastChunk: '',
        lastAt: 0
    };

    installGuardForStream(process.stdout, windowMs, stdoutState);
    installGuardForStream(process.stderr, windowMs, stderrState);
};

installOutputDuplicateGuard();
