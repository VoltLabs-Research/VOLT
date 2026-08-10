import type { EnrollmentResponseData } from '../contracts/http';

/** Credentials required for every control-channel interaction. */
export interface DaemonCredentials {
    /** Permanent identifier for this cluster instance. */
    teamClusterId: string;
    /**
     * Daemon password - may be rotated by the server on each enrollment cycle.
     * The client updates this internally after a successful enrollment.
     */
    daemonPassword: string;
    /**
     * One-time enrollment token issued when the cluster was provisioned.
     * Required only when `enrollmentOptions.enabled` is `true`.
     */
    enrollmentToken?: string;
    /** Semantic version string reported to the server during enrollment. */
    installedVersion?: string;
};

/** Options governing the enrollment HTTP request. */
export interface EnrollmentOptions {
    /**
     * Whether to perform enrollment on `connect()`.
     * When `false` the initial `daemonPassword` from `DaemonCredentials` is
     * used as-is and no healthcheck request is sent.
     * @default true when `enrollmentToken` is present
     */
    enabled?: boolean;
    /**
     * Full URL of the healthcheck endpoint, e.g.
     * `https://cloud.voltlabs.io/api/team-clusters/abc123/healthcheck`.
     * Required when enrollment is enabled.
     */
    url: string;
};

/** Result returned by a successful enrollment. */
export interface EnrollmentResult {
    daemonPassword: EnrollmentResponseData['daemonPassword'];
    teamCluster: EnrollmentResponseData['teamCluster'];
};
