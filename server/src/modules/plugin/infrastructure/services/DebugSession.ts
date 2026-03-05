import { v4 as uuidv4 } from 'uuid';
import logger from '@shared/infrastructure/logger';

type DebugNodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

interface DebugNodeInfo {
    nodeId: string;
    type: string;
};

interface DebugSessionConfig {
    pluginId: string;
    trajectoryId: string;
    timestep: number;
    config: Record<string, any>;
    socketId: string;
    userId: string;
};

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
            throw new Error('Debug session was aborted');
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
        this.aborted = true;
        this.clearInactivityTimer();
        if (this.gate) {
            const g = this.gate;
            this.gate = null;
            g.reject(new Error('Debug session stopped by user'));
        }
    }

    /**
     * Cleanup resources.
     */
    destroy(): void {
        this.aborted = true;
        this.clearInactivityTimer();
        if (this.gate) {
            const g = this.gate;
            this.gate = null;
            g.reject(new Error('Debug session destroyed'));
        }
        logger.debug(`[DebugSession] Session ${this.id} destroyed`);
    }

    private resetInactivityTimer(): void {
        this.clearInactivityTimer();
        this.inactivityTimer = setTimeout(() => {
            logger.warn(`[DebugSession] Session ${this.id} timed out due to inactivity`);
            this.stop();
        }, this.inactivityTimeout);
    }

    private clearInactivityTimer(): void {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
    }
};
