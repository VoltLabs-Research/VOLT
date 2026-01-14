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
     * Returns [shouldClean, remaining, status]
     */
    executeCleanupScript(
        sessionId: string,
        teamId: string
    ): Promise<[number, number, string]>;

    /**
     * Emit session completed event and perform cleanup
     */
    emitSessionCompleted(
        teamId: string,
        sessionId: string,
    ): Promise<void>;

    /**
     * Check and cleanup session after job completion
     */
    checkAndCleanupSession(job: Job): Promise<void>;
};