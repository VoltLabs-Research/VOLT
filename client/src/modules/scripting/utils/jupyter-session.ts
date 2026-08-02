import type { GetScriptingSessionStatusResponse } from '@volt/contracts/modules/scripting/domain';

export interface WaitForReadyScriptingSessionOptions {
    isCancelled?: () => boolean;
    onPending?: (session: GetScriptingSessionStatusResponse) => Promise<void> | void;
};

interface ScriptingSessionLoader {
    createSession: () => Promise<GetScriptingSessionStatusResponse>;
    readSession: (session: GetScriptingSessionStatusResponse) => Promise<GetScriptingSessionStatusResponse>;
};

export interface WaitForReadyScriptingSessionResult {
    session: GetScriptingSessionStatusResponse;
    timedOut: boolean;
};

const JUPYTER_SESSION_POLL_INTERVAL_MS = 2_000;
const JUPYTER_SESSION_TIMEOUT_MS = 120_000;
const JUPYTER_START_ERROR_MESSAGE = 'Failed to start Jupyter';

export const JUPYTER_SESSION_PENDING_MESSAGE = 'Jupyter is still starting. Please wait a moment.';
export const JUPYTER_SESSION_TIMEOUT_MESSAGE = 'Jupyter is still starting. Please retry in a moment.';

const sleep = (delayMs: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, delayMs));

const getRemainingTimeMs = (deadlineMs: number): number => Math.max(0, deadlineMs - Date.now());

/** Resolves null when the deadline wins the race against the status request. */
const readSessionWithinDeadline = async (
    readSession: () => Promise<GetScriptingSessionStatusResponse>,
    deadlineMs: number
): Promise<GetScriptingSessionStatusResponse | null> => {
    const remainingTimeMs = getRemainingTimeMs(deadlineMs);
    if (remainingTimeMs === 0) {
        return null;
    }

    return Promise.race([
        readSession(),
        sleep(remainingTimeMs).then(() => null)
    ]);
};

export const startAndWaitForReadyScriptingSession = async (
    { createSession, readSession }: ScriptingSessionLoader,
    { isCancelled, onPending }: WaitForReadyScriptingSessionOptions = {}
): Promise<WaitForReadyScriptingSessionResult> => {
    let lastSession = await createSession();
    if (lastSession.jupyter.ready || isCancelled?.()) {
        return {
            session: lastSession,
            timedOut: false
        };
    }

    const deadlineMs = Date.now() + JUPYTER_SESSION_TIMEOUT_MS;

    while (getRemainingTimeMs(deadlineMs) > 0) {
        if (isCancelled?.()) {
            break;
        }

        await onPending?.(lastSession);

        if (isCancelled?.()) {
            break;
        }

        await sleep(Math.min(JUPYTER_SESSION_POLL_INTERVAL_MS, getRemainingTimeMs(deadlineMs)));

        if (isCancelled?.()) {
            break;
        }

        const session = await readSessionWithinDeadline(() => readSession(lastSession), deadlineMs);
        if (!session) {
            return {
                session: lastSession,
                timedOut: true
            };
        }

        lastSession = session;
        if (lastSession.jupyter.ready) {
            return {
                session: lastSession,
                timedOut: false
            };
        }
    }

    return {
        session: lastSession,
        timedOut: true
    };
};

export const getJupyterStartErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return JUPYTER_START_ERROR_MESSAGE;
};
