
export interface EnrollmentRequestBody {
    enrollmentToken: string;
    installedVersion?: string;
};

export interface EnrollmentResponseData {
    daemonPassword: string;
    teamCluster: Record<string, unknown>;
};

export interface EnrollmentApiResponse {
    data: EnrollmentResponseData;
};
