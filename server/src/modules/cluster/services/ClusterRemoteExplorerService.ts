import { ErrorCodes } from '@core/constants/error-codes';
import type { ErrorCode } from '@core/constants/error-codes';
import {
    requireConfirmedPassword,
    requireOwnedTeamCluster
} from '@modules/cluster/services/cluster-access';
import remoteExplorerDaemonGateway from '@modules/cluster/services/RemoteExplorerDaemonGateway';
import teamClusterRemoteAccessSessionService from '@modules/cluster/services/TeamClusterRemoteAccessSessionService';
import {
    TeamClusterRemoteAccessTarget,
    type TeamClusterRemoteAccessSessionView,
    type TeamClusterRemoteExplorerEntryView,
    type TeamClusterRemoteExplorerNodeView
} from '@modules/cluster/services/TeamClusterRemoteAccess';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { readFilenameFromContentDisposition } from '@shared/infrastructure/http/responses/content-disposition';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import logger from '@shared/infrastructure/logger';
import type { Readable } from 'node:stream';

interface RemoteExplorerRequest {
    teamId: string;
    teamClusterId: string;
    userId: string;
    sessionId: string;
    target: TeamClusterRemoteAccessTarget;
    path: string;
}

const JSON_RENDERED_TARGETS = new Set<TeamClusterRemoteAccessTarget>([
    TeamClusterRemoteAccessTarget.DaemonTables
]);

/** Daemon table rows are rendered as JSON, so a download needs that suffix. */
const deriveFallbackFilename = (target: TeamClusterRemoteAccessTarget, path: string): string => {
    const lastSegment = path.split('/').filter(Boolean).pop() ?? 'download';
    return JSON_RENDERED_TARGETS.has(target) ? `${lastSegment}.json` : lastSegment;
};

/**
 * Password-confirmed read-only browsing of a cluster's own storage (minio buckets,
 * daemon tables) through the daemon. Every call re-validates the
 * short-lived remote-access session that the password confirmation issued.
 */
class ClusterRemoteExplorerService {
    async createRemoteAccessSession(input: {
        teamId: string;
        teamClusterId: string;
        userId: string;
        password: string;
        target: TeamClusterRemoteAccessTarget;
    }): Promise<{ session: TeamClusterRemoteAccessSessionView }> {
        await requireOwnedTeamCluster(input.teamClusterId, input.teamId);
        await requireConfirmedPassword(input.userId, input.password);

        const session = teamClusterRemoteAccessSessionService.createSession({
            userId: input.userId,
            teamId: input.teamId,
            teamClusterId: input.teamClusterId,
            target: input.target
        });

        logger.info(`Created team cluster remote access session teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId} target=${input.target}`);

        return { session };
    }

    async listRemoteExplorerEntries(input: RemoteExplorerRequest): Promise<{
        teamClusterId: string;
        target: TeamClusterRemoteAccessTarget;
        path: string;
        entries: TeamClusterRemoteExplorerEntryView[];
    }> {
        await this.#preflight(input);

        return {
            teamClusterId: input.teamClusterId,
            target: input.target,
            path: input.path,
            entries: await this.#viaDaemon(
                () => remoteExplorerDaemonGateway.listEntries(input),
                'TeamCluster::RemoteExplorerListFailed',
                'Failed to load remote explorer entries'
            )
        };
    }

    async getRemoteExplorerNode(input: RemoteExplorerRequest): Promise<{
        teamClusterId: string;
        target: TeamClusterRemoteAccessTarget;
        node: TeamClusterRemoteExplorerNodeView;
    }> {
        await this.#preflight(input);

        return {
            teamClusterId: input.teamClusterId,
            target: input.target,
            node: await this.#viaDaemon(
                () => remoteExplorerDaemonGateway.getNode(input),
                'TeamCluster::RemoteExplorerNodeFailed',
                'Failed to load remote explorer node'
            )
        };
    }

    async downloadRemoteExplorerObject(input: RemoteExplorerRequest): Promise<{
        stream: Readable;
        headers: Record<string, string>;
        prepare?: () => Promise<void>;
    }> {
        await this.#preflight(input);

        const response = await this.#viaDaemon(
            () => remoteExplorerDaemonGateway.downloadObject(input),
            'TeamCluster::RemoteExplorerDownloadFailed',
            'Failed to download remote explorer object',
            (error) => {
                if (error.code === ErrorCodes.TEAM_CLUSTER_DAEMON_STREAM_REQUEST_FAILED && error.statusCode === 404) {
                    return ApplicationError.notFound(
                        ErrorCodes.TEAM_CLUSTER_REMOTE_EXPLORER_OBJECT_NOT_FOUND,
                        'The requested remote explorer object was not found'
                    );
                }

                return error;
            }
        );
        const contentLength = Number(response.headers['content-length']);

        return createDownloadStreamResponse({
            stream: response.stream,
            contentType: response.headers['content-type'] || 'application/octet-stream',
            filename: readFilenameFromContentDisposition(response.headers['content-disposition'])
                || deriveFallbackFilename(input.target, input.path),
            contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
            disposition: 'attachment'
        });
    }

    async #preflight(input: RemoteExplorerRequest): Promise<void> {
        await requireOwnedTeamCluster(input.teamClusterId, input.teamId);

        const sessionResult = teamClusterRemoteAccessSessionService.validateSession({
            sessionId: input.sessionId,
            userId: input.userId,
            teamId: input.teamId,
            teamClusterId: input.teamClusterId,
            target: input.target
        });
        if (sessionResult instanceof Error) {
            throw sessionResult;
        }
    }

    /** A daemon-side failure already carries its own code; anything else is a bad request. */
    async #viaDaemon<T>(
        call: () => Promise<T>,
        failureCode: ErrorCode,
        failureMessage: string,
        mapApplicationError: (error: ApplicationError) => ApplicationError = (error) => error
    ): Promise<T> {
        try {
            return await call();
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw mapApplicationError(error);
            }

            throw ApplicationError.badRequest(
                failureCode,
                error instanceof Error ? error.message : failureMessage
            );
        }
    }
}

export default new ClusterRemoteExplorerService();
