import { DaemonClientError } from '../errors/DaemonClientError';
import type { EnrollmentOptions, EnrollmentResult } from './types';
import type { EnrollmentApiResponse } from '../contracts/http';

/**
 * Handles the HTTP enrollment (healthcheck) handshake with the Volt server.
 *
 * Posts the enrollment token and installed version to the server's
 * healthcheck endpoint and returns the rotated `daemonPassword` that must
 * be used for all subsequent socket registrations.
 */
export class EnrollmentClient {
    constructor(private readonly options: EnrollmentOptions) {}

    /**
     * Performs the enrollment healthcheck POST request.
     *
     * @param enrollmentToken - One-time token issued when the cluster was provisioned.
     * @param installedVersion - Semantic version of the running daemon binary.
     * @returns The rotated credential and team cluster snapshot from the server.
     * @throws {DaemonClientError} with code `ENROLLMENT_FAILED` on any HTTP or parse failure.
     */
    async enroll(enrollmentToken: string, installedVersion?: string): Promise<EnrollmentResult> {
        let response: Response;

        try {
            response = await fetch(this.options.url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ enrollmentToken, installedVersion })
            });
        } catch (cause: unknown) {
            throw DaemonClientError.enrollmentFailed(
                `Network error reaching enrollment endpoint: ${this.options.url}`,
                cause
            );
        }

        let body: unknown;

        try {
            body = await response.json();
        } catch (cause: unknown) {
            throw DaemonClientError.enrollmentFailed(
                `Enrollment endpoint returned non-JSON body (HTTP ${response.status})`,
                cause
            );
        }

        if (!response.ok) {
            throw DaemonClientError.enrollmentFailed(
                `Enrollment endpoint responded with HTTP ${response.status}`
            );
        }

        return this.parseResponse(body);
    }

    private parseResponse(body: unknown): EnrollmentResult {
        if (
            typeof body !== 'object' ||
            body === null ||
            Array.isArray(body) ||
            !('data' in body)
        ) {
            throw DaemonClientError.enrollmentFailed('Enrollment response missing top-level "data" field');
        }

        const data = (body as EnrollmentApiResponse).data;

        if (
            typeof data !== 'object' ||
            data === null ||
            typeof data.daemonPassword !== 'string' ||
            typeof data.teamCluster !== 'object' ||
            data.teamCluster === null
        ) {
            throw DaemonClientError.enrollmentFailed(
                'Enrollment response "data" does not contain expected fields (daemonPassword, teamCluster)'
            );
        }

        return {
            daemonPassword: data.daemonPassword,
            teamCluster: data.teamCluster
        };
    }
};
