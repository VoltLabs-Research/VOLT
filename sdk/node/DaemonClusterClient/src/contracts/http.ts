/** HTTP contract for the daemon enrollment (healthcheck) endpoint. */

export interface EnrollmentRequestBody {
    /** One-time token issued by the server when the cluster was provisioned. */
    enrollmentToken: string;
    /** Semantic version string of the currently running daemon binary. */
    installedVersion?: string;
};

export interface EnrollmentResponseData {
    /**
     * Rotated daemon password returned by the server after a successful
     * healthcheck. Must be used for all subsequent socket registrations and
     * command payloads until the next enrollment cycle.
     */
    daemonPassword: string;
    /** Snapshot of the team cluster document as stored in the server. */
    teamCluster: Record<string, unknown>;
};

export interface EnrollmentApiResponse {
    data: EnrollmentResponseData;
};
