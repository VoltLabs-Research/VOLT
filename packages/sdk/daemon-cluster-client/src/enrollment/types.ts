import type { EnrollmentResponseData } from '../contracts/http';

export interface DaemonCredentials {
    teamClusterId: string;
    daemonPassword: string;
    enrollmentToken?: string;
    installedVersion?: string;
};

export interface EnrollmentOptions {
    enabled?: boolean;
    url: string;
};

export interface EnrollmentResult {
    daemonPassword: EnrollmentResponseData['daemonPassword'];
    teamCluster: EnrollmentResponseData['teamCluster'];
};
