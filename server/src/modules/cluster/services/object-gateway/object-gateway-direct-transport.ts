import {
    headersFromIncoming,
    headersToObject,
    type RawHttpResponse
} from '@modules/cluster/services/object-gateway/object-gateway-responses';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import http from 'node:http';
import https from 'node:https';
import type { ObjectGatewayOperationName, ObjectGatewayRequestOptions } from '@modules/cluster/services/object-gateway/object-gateway-http-session-pool';

const DIRECT_REQUEST_TIMEOUT_MS = readPositiveIntegerEnv(
    'TEAM_CLUSTER_OBJECT_GATEWAY_DIRECT_REQUEST_TIMEOUT_MS',
    10 * 60 * 1000
);
const DIRECT_FAST_REQUEST_TIMEOUT_MS = readPositiveIntegerEnv(
    'TEAM_CLUSTER_OBJECT_GATEWAY_DIRECT_FAST_REQUEST_TIMEOUT_MS',
    45_000
);

/*
 * The tunnel pool was pinned to one socket per session because a reverse-channel
 * tunnel is a single stream. A real connection has no such constraint, so reads of
 * different objects stop queueing behind each other.
 */
const DIRECT_MAX_SOCKETS = readPositiveIntegerEnv('TEAM_CLUSTER_OBJECT_GATEWAY_DIRECT_MAX_SOCKETS', 32);

/* Metadata-only verbs must not sit behind the bulk transfer budget. */
const isFastOperation = (operation: ObjectGatewayOperationName): boolean => (
    operation === 'head' || operation === 'list'
);

/**
 * Raised when the gateway was never reached. Kept distinct from a gateway that
 * answered an error status: only the former justifies retrying over the tunnel,
 * and treating a 404 as "unreachable" would hide real failures behind a slow path.
 */
export class ObjectGatewayDialError extends Error {
    constructor(readonly cause: Error) {
        super(`Object gateway direct dial failed: ${cause.message}`);
        this.name = 'ObjectGatewayDialError';
    }
}

/**
 * Speaks the object gateway protocol straight to a daemon over HTTP.
 *
 * Same request construction as the tunnel path — the only difference is that the
 * socket underneath is a real one, so bytes are not reframed onto the control
 * connection. Requests carry the same direct-access token, so the daemon's
 * authorization is unchanged and remains the single gate on these objects.
 */
class ObjectGatewayDirectTransport {
    readonly #agentsByOrigin = new Map<string, http.Agent | https.Agent>();

    async request(
        baseUrl: string,
        options: ObjectGatewayRequestOptions,
        headers: Headers,
        operation: ObjectGatewayOperationName
    ): Promise<RawHttpResponse> {
        /*
         * The gateway paths are absolute, so resolving them against the base URL
         * would drop any path prefix an operator put there to route through an
         * ingress. The prefix is preserved by appending instead.
         */
        const target = new URL(baseUrl);
        const basePathPrefix = target.pathname.replace(/\/+$/, '');
        const requestTarget = `${basePathPrefix}${options.path}`;
        const isSecure = target.protocol === 'https:';
        const requestTimeoutMs = isFastOperation(operation)
            ? Math.min(DIRECT_FAST_REQUEST_TIMEOUT_MS, DIRECT_REQUEST_TIMEOUT_MS)
            : DIRECT_REQUEST_TIMEOUT_MS;

        return new Promise<RawHttpResponse>((resolve, reject) => {
            const transport = isSecure ? https : http;
            const request = transport.request({
                protocol: target.protocol,
                hostname: target.hostname,
                port: target.port || (isSecure ? 443 : 80),
                path: requestTarget,
                method: options.method,
                headers: headersToObject(headers),
                agent: this.#resolveAgent(target, isSecure)
            }, (response) => {
                resolve({
                    statusCode: response.statusCode || 0,
                    headers: headersFromIncoming(response.headers),
                    stream: response
                });
            });

            /*
             * A socket error before any response means the gateway was not reached,
             * so it is reported as a dial failure and the caller may tunnel instead.
             * Once headers have arrived the promise is already settled and this only
             * surfaces on the response stream, where retrying would be wrong.
             */
            request.once('error', (error: Error) => {
                reject(new ObjectGatewayDialError(error));
            });

            request.setTimeout(requestTimeoutMs, () => {
                request.destroy(new Error(`Object gateway direct request timed out after ${requestTimeoutMs}ms`));
            });

            if (!options.body) {
                request.end();
                return;
            }

            if (Buffer.isBuffer(options.body)) {
                request.end(options.body);
                return;
            }

            options.body.once('error', (error: Error) => {
                request.destroy(error);
            });
            options.body.pipe(request);
        });
    }

    #resolveAgent(target: URL, isSecure: boolean): http.Agent | https.Agent {
        const existingAgent = this.#agentsByOrigin.get(target.origin);
        if (existingAgent) {
            return existingAgent;
        }

        const agentOptions = {
            keepAlive: true,
            keepAliveMsecs: 30_000,
            maxSockets: DIRECT_MAX_SOCKETS,
            maxFreeSockets: Math.min(DIRECT_MAX_SOCKETS, 8)
        };
        const agent = isSecure ? new https.Agent(agentOptions) : new http.Agent(agentOptions);

        this.#agentsByOrigin.set(target.origin, agent);
        return agent;
    }
}

export default new ObjectGatewayDirectTransport();
