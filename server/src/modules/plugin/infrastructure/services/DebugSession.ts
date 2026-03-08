import { v4 as uuidv4 } from 'uuid';
import { ErrorCodes, type ErrorCode } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';

interface DebugSessionConfig {
    pluginId: string;
    trajectoryId: string;
    timestep: number;
    config: Record<string, unknown>;
    socketId: string;
    userId: string;
};

interface DebugSessionTermination {
    code: ErrorCode;
    details: string;
    statusCode: number;
    emitError: boolean;
}

/**
 * Represents a single debug session for step-through plugin execution.
 * Uses a gate (deferred promise) pattern to pause execution between nodes.
 */
export default class DebugSession {
    public readonly id: string;
    public readonly config: DebugSessionConfig;
    public continueMode: boolean = false;
    public aborted: boolean = false;
    
    private gate: { resolve: () => void; reject: (err: Error) => void } | null = null;
    private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly inactivityTimeout: number;
    private termination: DebugSessionTermination | null = null;

    constructor(config: DebugSessionConfig, inactivityTimeoutMs: number = 5 * 60 * 1000) {
        this.id = uuidv4();
        this.config = config;
        this.inactivityTimeout = inactivityTimeoutMs;
        this.resetInactivityTimer();
    }

    /**
     * Pauses execution until step() or continue() is called.
     * In continueMode, resolves immediately.
     * Throws if the session is aborted.
     */
    async waitForStep(): Promise<void> {
        if (this.aborted) {
            throw this.createTerminationError();
        }

        if (this.continueMode) {
            return;
        }

        this.resetInactivityTimer();

        return new Promise<void>((resolve, reject) => {
            this.gate = { resolve, reject };
        });
    }

    /**
     * Advance one step (resolve the current gate).
     */
    step(): void {
        this.resetInactivityTimer();
        if (this.gate) {
            const g = this.gate;
            this.gate = null;
            g.resolve();
        }
    }

    /**
     * Switch to continue mode (skip all future pauses) and resolve current gate.
     */
    continue(): void {
        this.continueMode = true;
        this.step();
    }

    /**
     * Abort the session. Rejects the current gate if waiting.
     */
    stop(): void {
        this.terminate({
            code: ErrorCodes.JOB_CANCELLED,
            details: 'Debug session stopped by user',
            statusCode: 400,
            emitError: false
        });
    }

    /**
     * Cleanup resources.
     */
    destroy(): void {
        this.terminate({
            code: ErrorCodes.INTERNAL_SERVER_ERROR,
            details: 'Debug session destroyed',
            statusCode: 500,
            emitError: false
        });

        logger.debug(`[DebugSession] Session ${this.id} destroyed`);
    }

    getTerminationError(): ApplicationError | null {
        if (!this.termination || !this.termination.emitError) {
            return null;
        }

        return this.createTerminationError();
    }

    private resetInactivityTimer(): void {
        this.clearInactivityTimer();
        this.inactivityTimer = setTimeout(() => {
            logger.warn(`[DebugSession] Session ${this.id} timed out due to inactivity`);

            this.terminate({
                code: ErrorCodes.WORKER_TIMEOUT,
                details: 'Debug session timed out due to inactivity',
                statusCode: 408,
                emitError: true
            });
        }, this.inactivityTimeout);
    }

    private clearInactivityTimer(): void {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
    }

    private terminate(termination: DebugSessionTermination): void {
        this.aborted = true;
        this.termination = termination;
        this.clearInactivityTimer();

        if (this.gate) {
            const gate = this.gate;
            this.gate = null;
            gate.reject(this.createTerminationError());
        }
    }

    private createTerminationError(): ApplicationError {
        if (!this.termination) {
            return ApplicationError.internalServerError('Debug session was aborted');
        }

        return new ApplicationError(
            this.termination.code,
            this.termination.details,
            this.termination.statusCode
        );
    }
};
