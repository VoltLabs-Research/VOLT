import { ErrorCodes, toErrorCode } from '@core/constants/error-codes';

import bytePlaneResolver from '@modules/cluster/services/object-gateway/BytePlaneResolver';
import ObjectGatewayAccessTokenProvider from '@modules/cluster/services/object-gateway/object-gateway-access-token';
import objectGatewayDirectTransport, {
    ObjectGatewayDialError
} from '@modules/cluster/services/object-gateway/object-gateway-direct-transport';
import ObjectGatewayHttpSessionPool from '@modules/cluster/services/object-gateway/object-gateway-http-session-pool';
import {
    buildCollectionPath,
    buildComposePath,
    buildObjectPath,
    buildReadHeaders,
    buildUploadHeaders
} from '@modules/cluster/services/object-gateway/object-gateway-paths';
import {
    headersToObject,
    parseHeadResponse,
    parseListEntry
} from '@modules/cluster/services/object-gateway/object-gateway-responses';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER } from '@shared/infrastructure/contracts/team-cluster';
import { buffer } from 'node:stream/consumers';
import type {
    ObjectGatewayOperationName,
    ObjectGatewayRequestOptions
} from '@modules/cluster/services/object-gateway/object-gateway-http-session-pool';
import type { TeamClusterObjectGatewayReadOptions } from '@modules/cluster/services/object-gateway/object-gateway-paths';
import type {
    ObjectGatewayJsonError,
    ObjectGatewayJsonListResponse,
    RawHttpResponse
} from '@modules/cluster/services/object-gateway/object-gateway-responses';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import type {
    TeamClusterObjectGatewayListRequest,
    TeamClusterObjectGatewayListEntry,
    TeamClusterObjectGatewayListResponse,
    TeamClusterObjectGatewayHeadResponse,
    TeamClusterObjectGatewayStreamResponse,
    TeamClusterObjectGatewayPutStreamRequest,
    TeamClusterObjectGatewayPutBufferRequest,
    TeamClusterObjectGatewayComposeRequest
} from '@shared/contracts/types/TeamClusterObjectGateway';

const DEFAULT_LIST_LIMIT = 100;

/*
 * A pooled keep-alive session can be handed out just after its tunnel died, and
 * the failure only shows up when we write to it. Node reports that as a reset
 * before any response, which is precisely the case a fresh session can replay.
 */
const isStaleSessionError = (error: unknown): boolean => {
    const code = (error as { code?: string }).code;
    return code === 'ECONNRESET' || code === 'EPIPE';
};

/* A stream body is consumed by the first attempt, so only these can be replayed. */
const isReplayableBody = (body: ObjectGatewayRequestOptions['body']): boolean => (
    body === undefined || Buffer.isBuffer(body)
);

/*
 * Object storage verbs against a team cluster's daemon object gateway, spoken
 * over an authorised keep-alive session on the daemon reverse channel.
 */
class TeamClusterObjectGatewayClient implements ITeamClusterObjectGatewayClient {
    private readonly accessTokenProvider = new ObjectGatewayAccessTokenProvider();
    private readonly httpSessionPool = new ObjectGatewayHttpSessionPool();

    async list(
        teamClusterId: string,
        request: TeamClusterObjectGatewayListRequest
    ): Promise<TeamClusterObjectGatewayListResponse> {
        const query = new URLSearchParams();
        query.set('limit', String(request.limit ?? DEFAULT_LIST_LIMIT));

        if (request.prefix) {
            query.set('prefix', request.prefix);
        }

        if (request.cursor) {
            query.set('cursor', request.cursor);
        }

        const response = await this.fetchJson<ObjectGatewayJsonListResponse>(teamClusterId, {
            method: 'GET',
            path: `${buildCollectionPath(request.bucket)}?${query.toString()}`
        }, 'list');

        return {
            keys: response.keys,
            objects: response.objects.map(parseListEntry),
            nextCursor: response.nextCursor
        };
    }

    async *listAllEntries(
        teamClusterId: string,
        request: Omit<TeamClusterObjectGatewayListRequest, 'cursor'>
    ): AsyncIterable<TeamClusterObjectGatewayListEntry> {
        let cursor: string | undefined;

        do {
            const page = await this.list(teamClusterId, {
                ...request,
                cursor
            });

            for (const entry of page.objects) {
                yield entry;
            }

            cursor = page.nextCursor;
        } while (cursor);
    }

    async *listAll(teamClusterId: string, request: Omit<TeamClusterObjectGatewayListRequest, 'cursor'>): AsyncIterable<string> {
        for await (const entry of this.listAllEntries(teamClusterId, request)) {
            yield entry.key;
        }
    }

    async head(teamClusterId: string, bucket: string, objectKey: string): Promise<TeamClusterObjectGatewayHeadResponse> {
        const response = await this.fetch(teamClusterId, {
            method: 'HEAD',
            path: buildObjectPath(bucket, objectKey)
        }, 'head');

        const head = parseHeadResponse(response.headers);
        await buffer(response.stream);

        return head;
    }

    async exists(teamClusterId: string, bucket: string, objectKey: string): Promise<boolean> {
        try {
            await this.head(teamClusterId, bucket, objectKey);
            return true;
        } catch (error) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                return false;
            }

            throw error;
        }
    }

    async getStream(
        teamClusterId: string,
        bucket: string,
        objectKey: string,
        options?: TeamClusterObjectGatewayReadOptions
    ): Promise<TeamClusterObjectGatewayStreamResponse> {
        const response = await this.fetch(teamClusterId, {
            method: 'GET',
            path: buildObjectPath(bucket, objectKey),
            headers: buildReadHeaders(options)
        }, 'get');

        return {
            ...parseHeadResponse(response.headers),
            headers: headersToObject(response.headers),
            stream: response.stream
        };
    }

    async getBuffer(teamClusterId: string, bucket: string, objectKey: string): Promise<Buffer> {
        const response = await this.fetch(teamClusterId, {
            method: 'GET',
            path: buildObjectPath(bucket, objectKey),
            headers: buildReadHeaders({ skipMetadata: true })
        }, 'get');

        return buffer(response.stream);
    }

    async putStream(teamClusterId: string, request: TeamClusterObjectGatewayPutStreamRequest): Promise<void> {
        await this.fetch(teamClusterId, {
            method: 'PUT',
            path: buildObjectPath(request.bucket, request.objectKey),
            headers: buildUploadHeaders(request),
            body: request.stream
        }, 'put').then((response) => buffer(response.stream));
    }

    async putBuffer(teamClusterId: string, request: TeamClusterObjectGatewayPutBufferRequest): Promise<void> {
        await this.fetch(teamClusterId, {
            method: 'PUT',
            path: buildObjectPath(request.bucket, request.objectKey),
            headers: buildUploadHeaders(request),
            body: request.buffer
        }, 'put').then((response) => buffer(response.stream));
    }

    async composeObject(teamClusterId: string, request: TeamClusterObjectGatewayComposeRequest): Promise<void> {
        const body = Buffer.from(JSON.stringify({
            objectKey: request.objectKey,
            sourceObjectKeys: request.sourceObjectKeys,
            ...(request.metadata ? { metadata: request.metadata } : {})
        }));

        await this.fetch(teamClusterId, {
            method: 'POST',
            path: buildComposePath(request.bucket),
            headers: {
                'content-type': 'application/json',
                'content-length': String(body.length)
            },
            body
        }, 'compose').then((response) => buffer(response.stream));
    }

    async deleteObject(teamClusterId: string, bucket: string, objectKey: string): Promise<void> {
        await this.fetch(teamClusterId, {
            method: 'DELETE',
            path: buildObjectPath(bucket, objectKey)
        }, 'delete').then((response) => buffer(response.stream));
    }

    async deleteByPrefix(teamClusterId: string, bucket: string, prefix: string): Promise<number | undefined> {
        const query = new URLSearchParams();
        query.set('prefix', prefix);

        const response = await this.fetchJson<{ deletedCount: number }>(teamClusterId, {
            method: 'DELETE',
            path: `${buildCollectionPath(bucket)}?${query.toString()}`
        }, 'delete-prefix');

        return response.deletedCount;
    }

    private async fetchJson<T>(
        teamClusterId: string,
        options: ObjectGatewayRequestOptions,
        operation: ObjectGatewayOperationName
    ): Promise<T> {
        const response = await this.fetch(teamClusterId, options, operation);
        return JSON.parse((await buffer(response.stream)).toString('utf8')) as T;
    }

    private async fetch(
        teamClusterId: string,
        options: ObjectGatewayRequestOptions,
        operation: ObjectGatewayOperationName
    ): Promise<RawHttpResponse> {
        try {
            return await this.attempt(teamClusterId, options, operation);
        } catch (error) {
            if (!isStaleSessionError(error) || !isReplayableBody(options.body)) {
                throw error;
            }

            /* Every pooled session shares the reverse channel that just died. */
            this.httpSessionPool.discardCluster(teamClusterId);
            return this.attempt(teamClusterId, options, operation);
        }
    }

    private async attempt(
        teamClusterId: string,
        options: ObjectGatewayRequestOptions,
        operation: ObjectGatewayOperationName
    ): Promise<RawHttpResponse> {
        const accessToken = await this.accessTokenProvider.resolve(teamClusterId);
        const headers = new Headers(options.headers);
        headers.set(TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER, accessToken.token);

        const baseUrl = bytePlaneResolver.resolveBaseUrl(teamClusterId);
        if (baseUrl) {
            try {
                return await this.attemptDirect(baseUrl, options, headers, operation);
            } catch (error) {
                if (!(error instanceof ObjectGatewayDialError)) {
                    throw error;
                }

                /*
                 * A pooled keep-alive socket can be handed out just after the gateway
                 * closed it. That says nothing about reachability, so it is rethrown
                 * for the caller's replay rather than demoting the whole cluster.
                 */
                if (isStaleSessionError(error.cause)) {
                    throw error.cause;
                }

                /* A stream body is already partly consumed, so there is nothing to replay onto the tunnel. */
                if (!isReplayableBody(options.body)) {
                    throw error;
                }

                bytePlaneResolver.markUnreachable(teamClusterId, error.cause.message);
            }
        }

        return this.attemptOverTunnel(teamClusterId, options, headers, operation);
    }

    /* Straight to the daemon: no session to lease, so nothing to release. */
    private async attemptDirect(
        baseUrl: string,
        options: ObjectGatewayRequestOptions,
        headers: Headers,
        operation: ObjectGatewayOperationName
    ): Promise<RawHttpResponse> {
        const response = await objectGatewayDirectTransport.request(baseUrl, options, headers, operation);

        if (response.statusCode >= 200 && response.statusCode < 300) {
            return response;
        }

        throw await this.toGatewayError(response, operation);
    }

    private async attemptOverTunnel(
        teamClusterId: string,
        options: ObjectGatewayRequestOptions,
        headers: Headers,
        operation: ObjectGatewayOperationName
    ): Promise<RawHttpResponse> {
        const session = await this.httpSessionPool.acquire(teamClusterId, operation);

        try {
            const response = await this.httpSessionPool.request(session, options, headers, operation);

            if (response.statusCode >= 200 && response.statusCode < 300) {
                this.httpSessionPool.bindResponseLifecycle(response.stream, session);
                return response;
            }

            const gatewayError = await this.toGatewayError(response, operation);
            this.httpSessionPool.release(session);
            throw gatewayError;
        } catch (error) {
            this.httpSessionPool.release(session, true);
            throw error;
        }
    }

    private async toGatewayError(
        response: RawHttpResponse,
        operation: ObjectGatewayOperationName
    ): Promise<ApplicationError> {
        const payloadBuffer = await buffer(response.stream);

        /* The error body is an untyped wire payload: a failing gateway may not answer JSON at all. */
        let payload: ObjectGatewayJsonError | undefined;
        try {
            payload = JSON.parse(payloadBuffer.toString('utf8')) as ObjectGatewayJsonError;
        } catch {
            payload = undefined;
        }

        return new ApplicationError(
            // The code may come from a remote gateway, so it is narrowed to a
            // registered one; `operation` belongs in the message, not in a
            // template-built code that no error table could ever list.
            toErrorCode(payload?.code, ErrorCodes.CLUSTER_OBJECT_GATEWAY_FAILED),
            payload?.message
                ?? `Object gateway ${operation} failed with status ${response.statusCode}`,
            response.statusCode >= 400 ? response.statusCode : 500
        );
    }
}

export default new TeamClusterObjectGatewayClient();
