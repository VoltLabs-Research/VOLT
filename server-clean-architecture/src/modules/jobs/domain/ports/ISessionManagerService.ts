import Job from "../entities/Job";

export interface SessionManagerConfig{
    queueName: string;
    sessionTTLSeconds: number;
};

export interface ISessionManagerService{
    /**
     * Generate a unique session ID.
     */
    generateSessionID(): string;

    initialize(config: SessionManagerConfig): void;

    /**
     * Initialize a new session
     */
    initializeSession(
        sessionId: string,
        sessionStartTime: Date,
        jobCount: number,
        firstJob: Job
    ): Promise<void>;

    /**
     * Execute cleanup script for a session
     * Returns [shouldClean, remaining, status, sessionData]
     */
    executeCleanupScript(
        sessionId: string
    ): Promise<[number, number, string, string | null]>;

    /**
     * Emit session completed event and perform cleanup
     */
    emitSessionCompleted(
        teamId: string,
        sessionId: string,
        sessionDataRaw: string
    ): Promise<void>;

    /**
     * Check and cleanup session after job completion
     */
    checkAndCleanupSession(job: Job): Promise<void>;
};