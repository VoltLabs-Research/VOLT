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

const DIRECT_MAX_SOCKETS = readPositiveIntegerEnv('TEAM_CLUSTER_OBJECT_GATEWAY_DIRECT_MAX_SOCKETS', 32);

const isFastOperation = (operation: ObjectGatewayOperationName): boolean => (
    operation === 'head' || operation === 'list'
);

export class ObjectGatewayDialError extends Error {
    constructor(readonly cause: Error) {
        super(`Object gateway direct dial failed: ${cause.message}`);
        this.name = 'ObjectGatewayDialError';
    }
}

class ObjectGatewayDirectTransport {
    readonly #agentsByOrigin = new Map<string, http.Agent | https.Agent>();

    async request(
        baseUrl: string,
        options: ObjectGatewayRequestOptions,
        headers: Headers,
        operation: ObjectGatewayOperationName
    ): Promise<RawHttpResponse> {
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
