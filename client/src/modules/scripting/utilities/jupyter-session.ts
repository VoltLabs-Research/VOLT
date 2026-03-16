import type { ScriptingSession } from '@/modules/scripting/api/entities/scripting-session';

export interface WaitForReadyScriptingSessionOptions {
    intervalMs?: number;
    timeoutMs?: number;
    isCancelled?: () => boolean;
    onPending?: (session: ScriptingSession, attempt: number) => Promise<void> | void;
};

export interface WaitForReadyScriptingSessionStateLoader {
    initialSession: ScriptingSession;
    readSession: (session: ScriptingSession) => Promise<ScriptingSession>;
};

export interface WaitForReadyScriptingSessionResult {
    session: ScriptingSession;
    timedOut: boolean;
};

interface ReadSessionWithinDeadlineTimeoutResult {
    timedOut: true;
};

interface ReadSessionWithinDeadlineSuccessResult {
    session: ScriptingSession;
    timedOut: false;
};

export interface StartAndWaitForReadyScriptingSessionStateLoader {
    createSession: () => Promise<ScriptingSession>;
    readSession: (session: ScriptingSession) => Promise<ScriptingSession>;
};

type ReadSessionWithinDeadlineResult = ReadSessionWithinDeadlineTimeoutResult | ReadSessionWithinDeadlineSuccessResult;

const DEFAULT_JUPYTER_SESSION_POLL_INTERVAL_MS = 2_000;
const DEFAULT_JUPYTER_SESSION_TIMEOUT_MS = 120_000;

export const JUPYTER_SESSION_PENDING_MESSAGE = 'Jupyter is still starting. Please wait a moment.';
export const JUPYTER_SESSION_TIMEOUT_MESSAGE = 'Jupyter is still starting. Please retry in a moment.';

/**
 * Normalizes absolute backend Jupyter URLs to a same-origin proxy path during development.
 */
export const normalizeScriptingJupyterUrl = (url: string): string => {
    if (!import.meta.env.DEV || typeof window === 'undefined') {
        return url;
    }

    let parsedUrl: URL;

    try {
        parsedUrl = new URL(url);
    } catch {
        return url;
    }

    if (parsedUrl.origin === window.location.origin) {
        return url;
    }

    if (!parsedUrl.pathname.startsWith('/api/jupyter/')) {
        return url;
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
};

const sleep = async (delayMs: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
};

const getRemainingTimeMs = (deadlineMs: number): number => {
    return Math.max(0, deadlineMs - Date.now());
};

const readSessionWithinDeadline = async (
    readSession: () => Promise<ScriptingSession>,
    deadlineMs: number
): Promise<ReadSessionWithinDeadlineResult> => {
    const remainingTimeMs = getRemainingTimeMs(deadlineMs);
    if (remainingTimeMs === 0) {
        return {
            timedOut: true
        };
    }

    const timeoutPromise = sleep(remainingTimeMs).then<ReadSessionWithinDeadlineResult>(() => ({
        timedOut: true
    }));
    const sessionPromise = readSession().then<ReadSessionWithinDeadlineResult>((session) => ({
        session,
        timedOut: false
    }));

    return Promise.race([sessionPromise, timeoutPromise]);
};

/**
 * Re-checks notebook session startup using an initial create result plus repeated status reads
 * until Jupyter reports ready or the polling window expires.
 */
export const waitForReadyScriptingSession = async (
    stateLoader: WaitForReadyScriptingSessionStateLoader,
    options: WaitForReadyScriptingSessionOptions = {}
): Promise<WaitForReadyScriptingSessionResult> => {
    const intervalMs = Math.max(250, options.intervalMs ?? DEFAULT_JUPYTER_SESSION_POLL_INTERVAL_MS);
    const timeoutMs = Math.max(intervalMs, options.timeoutMs ?? DEFAULT_JUPYTER_SESSION_TIMEOUT_MS);
    const deadlineMs = Date.now() + timeoutMs;
    let lastSession = stateLoader.initialSession;
    let attempt = 1;

    if (lastSession.jupyter.ready) {
        return {
            session: lastSession,
            timedOut: false
        };
    }

    while (getRemainingTimeMs(deadlineMs) > 0) {
        if (options.isCancelled?.()) {
            break;
        }

        if (options.onPending) {
            await options.onPending(lastSession, attempt);
        }

        if (options.isCancelled?.()) {
            break;
        }

        const remainingTimeMs = getRemainingTimeMs(deadlineMs);
        if (remainingTimeMs > 0) {
            await sleep(Math.min(intervalMs, remainingTimeMs));
        }

        if (options.isCancelled?.()) {
            break;
        }

        const readResult = await readSessionWithinDeadline(() => stateLoader.readSession(lastSession), deadlineMs);
        if (readResult.timedOut) {
            return {
                session: lastSession,
                timedOut: true
            };
        }

        lastSession = readResult.session;
        if (lastSession.jupyter.ready) {
            return {
                session: lastSession,
                timedOut: false
            };
        }

        attempt += 1;
    }

    return {
        session: lastSession,
        timedOut: true
    };
};

/** Creates a session and reuses the shared readiness polling flow for startup. */
export const startAndWaitForReadyScriptingSession = async (
    stateLoader: StartAndWaitForReadyScriptingSessionStateLoader,
    options: WaitForReadyScriptingSessionOptions = {}
): Promise<WaitForReadyScriptingSessionResult> => {
    const session = await stateLoader.createSession();
    if (session.jupyter.ready || options.isCancelled?.()) {
        return {
            session,
            timedOut: false
        };
    }

    return waitForReadyScriptingSession({
        initialSession: session,
        readSession: stateLoader.readSession
    }, options);
};
