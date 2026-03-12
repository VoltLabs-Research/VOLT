import type { ScriptingSession } from '@/modules/scripting/api/entities/scripting-session';

export interface WaitForReadyScriptingSessionOptions {
    intervalMs?: number;
    timeoutMs?: number;
    isCancelled?: () => boolean;
    onPending?: (session: ScriptingSession, attempt: number) => Promise<void> | void;
};

export interface WaitForReadyScriptingSessionResult {
    session: ScriptingSession | null;
    timedOut: boolean;
};

interface LoadSessionWithinDeadlineResult {
    session: ScriptingSession | null;
    timedOut: boolean;
};

const DEFAULT_JUPYTER_SESSION_POLL_INTERVAL_MS = 2_000;
const DEFAULT_JUPYTER_SESSION_TIMEOUT_MS = 120_000;

export const JUPYTER_SESSION_PENDING_MESSAGE = 'Jupyter is still starting. Please wait a moment.';
export const JUPYTER_SESSION_TIMEOUT_MESSAGE = 'Jupyter is still starting. Please retry in a moment.';

const sleep = async (delayMs: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
};

const getRemainingTimeMs = (deadlineMs: number): number => {
    return Math.max(0, deadlineMs - Date.now());
};

const loadSessionWithinDeadline = async (
    loadSession: () => Promise<ScriptingSession>,
    deadlineMs: number
): Promise<LoadSessionWithinDeadlineResult> => {
    const remainingTimeMs = getRemainingTimeMs(deadlineMs);
    if (remainingTimeMs === 0) {
        return {
            session: null,
            timedOut: true
        };
    }

    const timeoutPromise = sleep(remainingTimeMs).then<LoadSessionWithinDeadlineResult>(() => ({
        session: null,
        timedOut: true
    }));
    const sessionPromise = loadSession().then<LoadSessionWithinDeadlineResult>((session) => ({
        session,
        timedOut: false
    }));

    return Promise.race([sessionPromise, timeoutPromise]);
};

/**
 * Re-checks notebook session startup until Jupyter reports ready or the polling window expires.
 */
export const waitForReadyScriptingSession = async (
    loadSession: () => Promise<ScriptingSession>,
    options: WaitForReadyScriptingSessionOptions = {}
): Promise<WaitForReadyScriptingSessionResult> => {
    const intervalMs = Math.max(250, options.intervalMs ?? DEFAULT_JUPYTER_SESSION_POLL_INTERVAL_MS);
    const timeoutMs = Math.max(intervalMs, options.timeoutMs ?? DEFAULT_JUPYTER_SESSION_TIMEOUT_MS);
    const deadlineMs = Date.now() + timeoutMs;
    let lastSession: ScriptingSession | null = null;
    let attempt = 0;

    while (getRemainingTimeMs(deadlineMs) > 0) {
        if (options.isCancelled?.()) {
            break;
        }

        attempt += 1;

        const loadResult = await loadSessionWithinDeadline(loadSession, deadlineMs);
        if (loadResult.timedOut) {
            return {
                session: lastSession,
                timedOut: true
            };
        }

        if (!loadResult.session) {
            break;
        }

        lastSession = loadResult.session;
        if (lastSession.jupyter.ready) {
            return {
                session: lastSession,
                timedOut: false
            };
        }

        if (options.onPending) {
            await options.onPending(lastSession, attempt);
        }

        const remainingTimeMs = getRemainingTimeMs(deadlineMs);
        if (remainingTimeMs > 0) {
            await sleep(Math.min(intervalMs, remainingTimeMs));
        }
    }

    if (!lastSession) {
        if (!options.isCancelled?.()) {
            return {
                session: null,
                timedOut: true
            };
        }

        throw new Error('Jupyter session polling was cancelled before the first request completed');
    }

    return {
        session: lastSession,
        timedOut: true
    };
};
