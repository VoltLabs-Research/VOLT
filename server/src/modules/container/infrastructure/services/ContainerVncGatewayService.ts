import { ErrorCodes } from '@core/constants/error-codes';
import { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { inject, injectable } from 'tsyringe';
import { WebSocketServer } from 'ws';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { RawData, WebSocket } from 'ws';

interface CreateContainerVncSessionInput {
    teamId: string;
    containerId: string;
    userId: string;
    teamClusterId: string;
    exposureId: string;
    password: string;
    parentOrigin: string;
    width?: number;
    height?: number;
    dpi?: number;
};

interface ContainerVncTokenPayload {
    type: 'container-vnc';
    teamId: string;
    containerId: string;
    userId: string;
    teamClusterId: string;
    exposureId: string;
    password: string;
    width: number;
    height: number;
    dpi: number;
    expiresAt: number;
};

interface ContainerVncTokenEnvelope {
    iv: string;
    value: string;
};

interface ContainerVncConnectRequest {
    teamId: string;
    containerId: string;
    token: string;
    parentOrigin?: string;
};

interface ContainerVncFrameAncestorsDirectiveInput {
    clientHost?: string;
    clientDevHost?: string;
};

export interface ContainerVncSessionDescriptor {
    noVncUrl: string;
    expiresAt: string;
    parentOrigin: string;
};

const TOKEN_CYPHER = 'aes-256-cbc';
const VNC_BASE_PATH = '/api/container-vnc';
const DEFAULT_SESSION_TTL_MS = 120_000;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_DPI = 96;

const readNumberEnv = (name: string, fallback: number): number => {
    const rawValue = process.env[name]?.trim();
    if (!rawValue) {
        return fallback;
    }

    const value = Number(rawValue);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }

    return value;
};

const buildFrameAncestorsDirective = (input: ContainerVncFrameAncestorsDirectiveInput): string => {
    const frameAncestors = new Set<string>(['\'self\'']);

    for (const origin of [input.clientHost, input.clientDevHost]) {
        if (origin?.trim()) {
            frameAncestors.add(origin.trim());
        }
    }

    return `frame-ancestors ${Array.from(frameAncestors).join(' ')}`;
};

const normalizeOrigin = (value: string): string => {
    return new URL(value).origin;
};

const getAllowedParentOrigins = (): string[] => {
    const origins = new Set<string>();

    for (const origin of [process.env.CLIENT_HOST, process.env.CLIENT_DEV_HOST]) {
        if (origin?.trim()) {
            origins.add(normalizeOrigin(origin.trim()));
        }
    }

    return Array.from(origins);
};

const getSecretKey = (): Buffer => {
    const secret = process.env.SECRET_KEY?.trim();
    if (!secret) {
        throw new Error('SECRET_KEY is required to initialize VNC sessions');
    }

    return createHash('sha256').update(secret).digest();
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isContainerVncTokenPayload = (value: unknown): value is ContainerVncTokenPayload => {
    if (!isRecord(value)) {
        return false;
    }

    return value.type === 'container-vnc'
        && typeof value.teamId === 'string'
        && typeof value.containerId === 'string'
        && typeof value.userId === 'string'
        && typeof value.teamClusterId === 'string'
        && typeof value.exposureId === 'string'
        && typeof value.password === 'string'
        && typeof value.width === 'number'
        && typeof value.height === 'number'
        && typeof value.dpi === 'number'
        && typeof value.expiresAt === 'number';
};

const normalizeWebSocketPayload = (data: RawData): Buffer | string => {
    if (typeof data === 'string') {
        return data;
    }

    if (Buffer.isBuffer(data)) {
        return data;
    }

    if (Array.isArray(data)) {
        return Buffer.concat(data.map((chunk) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    }

    return Buffer.from(data);
};

const writeUpgradeError = (socket: Duplex, statusCode: number, message: string): void => {
    socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
};

const escapeHtml = (value: string): string => {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

@injectable()
export class ContainerVncGatewayService {
    private readonly encryptionKey = getSecretKey();
    private readonly sessionTtlMs = readNumberEnv(
        'CONTAINER_VNC_SESSION_TTL_MS',
        DEFAULT_SESSION_TTL_MS
    );
    private readonly webSocketServer = new WebSocketServer({
        noServer: true
    });

    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    public createSession(input: CreateContainerVncSessionInput): ContainerVncSessionDescriptor {
        const parentOrigin = this.requireAllowedParentOrigin(input.parentOrigin);
        const expiresAt = Date.now() + this.sessionTtlMs;
        const token = this.encrypt({
            type: 'container-vnc',
            teamId: input.teamId,
            containerId: input.containerId,
            userId: input.userId,
            teamClusterId: input.teamClusterId,
            exposureId: input.exposureId,
            password: input.password,
            width: input.width ?? DEFAULT_WIDTH,
            height: input.height ?? DEFAULT_HEIGHT,
            dpi: input.dpi ?? DEFAULT_DPI,
            expiresAt
        });
        const noVncUrl = this.buildConnectPath(input.teamId, input.containerId, token, parentOrigin);

        logger.info({
            action: 'container.vnc.session.created',
            teamId: input.teamId,
            containerId: input.containerId,
            userId: input.userId,
            exposureId: input.exposureId,
            expiresAt: new Date(expiresAt).toISOString()
        }, 'Created direct noVNC session target');

        return {
            noVncUrl,
            expiresAt: new Date(expiresAt).toISOString(),
            parentOrigin
        };
    }

    public buildConnectPage(input: ContainerVncConnectRequest): string {
        if (!input.parentOrigin) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Parent origin is required');
        }

        const session = this.requireValidSession(input);
        const webSocketPath = this.buildWebSocketPath(input.teamId, input.containerId, input.token);
        const parentOrigin = escapeHtml(this.requireAllowedParentOrigin(input.parentOrigin));
        const title = escapeHtml(`Container ${input.containerId} Remote Desktop`);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta http-equiv="Cache-Control" content="no-store" />
    <style>
        :root {
            color-scheme: dark;
            font-family: Inter, system-ui, sans-serif;
        }

        body {
            margin: 0;
            background: #0f1115;
            color: #f5f7fa;
            display: grid;
            grid-template-rows: auto 1fr;
            min-height: 100vh;
        }

        .toolbar {
            display: flex;
            gap: 0.75rem;
            align-items: center;
            padding: 0.75rem 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            background: #171a21;
        }

        .status {
            color: #a9b3c1;
            font-size: 0.95rem;
        }

        #screen {
            width: 100%;
            height: calc(100vh - 58px);
            overflow: hidden;
        }

        #screen canvas {
            outline: none;
        }
    </style>
</head>
<body data-vnc-parent-origin="${parentOrigin}" data-vnc-password="${escapeHtml(session.password)}" data-vnc-websocket-path="${escapeHtml(webSocketPath)}">
    <div class="toolbar">
        <strong>Volt Remote Desktop</strong>
        <span class="status" id="status">Connecting…</span>
    </div>
    <div id="screen"></div>
    <script type="module" src="${this.buildConnectClientScriptPath()}"></script>
</body>
</html>`;
    }

    public getConnectClientScript(): string {
        return `const FRAME_MESSAGE_SOURCE = 'volt:container-vnc';
const FRAME_MESSAGE_TYPE_READY = 'ready';
const FRAME_MESSAGE_TYPE_ERROR = 'error';
const FRAME_MESSAGE_TYPE_DISCONNECTED = 'disconnected';
const NO_VNC_RFB_MODULE_PATH = '${VNC_BASE_PATH}/novnc/lib/rfb.js';

const screen = document.getElementById('screen');
const status = document.getElementById('status');

const setStatus = (nextStatus) => {
    if (status instanceof HTMLElement) {
        status.textContent = nextStatus;
    }
};

const postToParent = (type, message, clean) => {
    if (window.parent === window) {
        return;
    }

    const parentOrigin = readConfig().parentOrigin;
    if (!parentOrigin) {
        return;
    }

    const payload = {
        source: FRAME_MESSAGE_SOURCE,
        type
    };

    if (typeof message === 'string' && message.length > 0) {
        payload.message = message;
    }

    if (typeof clean === 'boolean') {
        payload.clean = clean;
    }

    window.parent.postMessage(payload, parentOrigin);
};

const readConfig = () => {
    if (!(document.body instanceof HTMLBodyElement)) {
        throw new Error('Remote desktop page failed to initialize.');
    }

    const password = document.body.dataset.vncPassword;
    const parentOrigin = document.body.dataset.vncParentOrigin;
    const websocketPath = document.body.dataset.vncWebsocketPath;
    if (!password || !websocketPath || !parentOrigin) {
        throw new Error('Remote desktop session data is missing.');
    }

    return {
        parentOrigin,
        password,
        websocketPath
    };
};

const buildWebSocketUrl = (websocketPath) => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return protocol + '://' + window.location.host + websocketPath;
};

const initializeRemoteDesktop = async () => {
    if (!(screen instanceof HTMLElement)) {
        throw new Error('Remote desktop surface is unavailable.');
    }

    const config = readConfig();
    const url = buildWebSocketUrl(config.websocketPath);
    const { default: RFB } = await import(NO_VNC_RFB_MODULE_PATH);
    const rfb = new RFB(screen, url, {
        credentials: {
            password: config.password
        }
    });

    rfb.scaleViewport = true;
    rfb.resizeSession = true;
    rfb.background = '#0f1115';

    rfb.addEventListener('connect', () => {
        setStatus('Connected');
        postToParent(FRAME_MESSAGE_TYPE_READY);
    });
    rfb.addEventListener('disconnect', (event) => {
        const isCleanDisconnect = Boolean(event.detail?.clean);
        const disconnectMessage = isCleanDisconnect
            ? 'Remote desktop disconnected.'
            : 'Remote desktop connection lost.';

        setStatus(isCleanDisconnect ? 'Disconnected' : 'Connection lost');
        postToParent(FRAME_MESSAGE_TYPE_DISCONNECTED, disconnectMessage, isCleanDisconnect);
    });
    rfb.addEventListener('credentialsrequired', () => {
        rfb.sendCredentials({
            password: config.password
        });
    });
    rfb.addEventListener('securityfailure', () => {
        setStatus('Authentication failed');
        postToParent(FRAME_MESSAGE_TYPE_ERROR, 'Remote desktop authentication failed.');
    });
};

initializeRemoteDesktop().catch((error) => {
    const message = error instanceof Error
        ? error.message
        : 'Failed to initialize remote desktop.';

    setStatus('Failed to connect');
    postToParent(FRAME_MESSAGE_TYPE_ERROR, message);
});`;
    }

    public isVncUpgradeRequest(request: IncomingMessage): boolean {
        const requestUrl = new URL(request.url || '', 'http://volt.local');
        return /^\/api\/container-vnc\/[^/]+\/[^/]+\/ws$/.test(requestUrl.pathname);
    }

    public async handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
        const requestUrl = new URL(request.url || '', 'http://volt.local');
        const pathMatch = requestUrl.pathname.match(/^\/api\/container-vnc\/([^/]+)\/([^/]+)\/ws$/);
        if (!pathMatch) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'VNC websocket route not found');
        }

        const session = this.requireValidSession({
            teamId: decodeURIComponent(pathMatch[1]),
            containerId: decodeURIComponent(pathMatch[2]),
            token: requestUrl.searchParams.get('token') || ''
        });
        const tunnel = await this.teamClusterDaemonClient.openTunnel(
            session.teamClusterId,
            session.exposureId,
            TeamClusterServiceExposureAccessMode.Tcp
        );

        this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
            this.bindWebSocketProxy(webSocket, tunnel);
        });
    }

    public handleUpgradeError(socket: Duplex, error: unknown): void {
        const mappedError = error instanceof ApplicationError
            ? error
            : new ApplicationError('Container::VncUpgradeFailed', 'VNC WebSocket upgrade failed', 500);
        const message = mappedError instanceof Error ? mappedError.message : 'VNC WebSocket upgrade failed';

        writeUpgradeError(socket, mappedError.statusCode, message);
    }

    public getConnectPageSecurityPolicy(): string {
        return [
            "default-src 'self'",
            "img-src 'self' data:",
            "style-src 'self' 'unsafe-inline'",
            "script-src 'self'",
            "connect-src 'self' ws: wss:",
            "font-src 'self' data:",
            buildFrameAncestorsDirective({
                clientHost: process.env.CLIENT_HOST,
                clientDevHost: process.env.CLIENT_DEV_HOST
            })
        ].join('; ');
    }

    private bindWebSocketProxy(webSocket: WebSocket, tunnel: Duplex): void {
        tunnel.on('data', (chunk: Buffer) => {
            webSocket.send(chunk, {
                binary: true
            });
        });
        tunnel.on('close', () => {
            webSocket.close(1000, 'Remote VNC tunnel closed');
        });
        tunnel.on('end', () => {
            webSocket.close(1000, 'Remote VNC tunnel ended');
        });
        tunnel.on('error', () => {
            webSocket.close(1011, 'Remote VNC tunnel failed');
        });

        webSocket.on('message', (data) => {
            tunnel.write(normalizeWebSocketPayload(data));
        });
        webSocket.on('close', () => {
            tunnel.destroy();
        });
        webSocket.on('error', () => {
            tunnel.destroy();
        });
    }

    private requireValidSession(input: ContainerVncConnectRequest): ContainerVncTokenPayload {
        if (!input.token) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, 'VNC session token is required');
        }

        if (input.parentOrigin) {
            this.requireAllowedParentOrigin(input.parentOrigin);
        }

        const payload = this.decrypt(input.token);
        if (payload.expiresAt < Date.now()) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_UNAUTHORIZED, 'VNC session token expired');
        }

        if (payload.teamId !== input.teamId || payload.containerId !== input.containerId) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, 'VNC session token does not match the requested container');
        }

        return payload;
    }

    private buildConnectPath(teamId: string, containerId: string, token: string, parentOrigin: string): string {
        return `${VNC_BASE_PATH}/${encodeURIComponent(teamId)}/${encodeURIComponent(containerId)}/connect?token=${encodeURIComponent(token)}&parentOrigin=${encodeURIComponent(parentOrigin)}`;
    }

    private requireAllowedParentOrigin(parentOrigin: string): string {
        if (!parentOrigin.trim()) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Parent origin is required');
        }

        let normalizedParentOrigin: string;
        try {
            normalizedParentOrigin = normalizeOrigin(parentOrigin);
        } catch {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Parent origin must be a valid HTTP(S) origin');
        }

        const allowedParentOrigins = getAllowedParentOrigins();
        if (!allowedParentOrigins.includes(normalizedParentOrigin)) {
            throw ApplicationError.forbidden(ErrorCodes.TEAM_ACCESS_DENIED, 'Parent origin is not allowed for VNC embedding');
        }

        return normalizedParentOrigin;
    }

    private buildConnectClientScriptPath(): string {
        return `${VNC_BASE_PATH}/connect-client.js`;
    }

    private buildWebSocketPath(teamId: string, containerId: string, token: string): string {
        return `${VNC_BASE_PATH}/${encodeURIComponent(teamId)}/${encodeURIComponent(containerId)}/ws?token=${encodeURIComponent(token)}`;
    }

    private encrypt(payload: ContainerVncTokenPayload): string {
        const iv = randomBytes(16);
        const cipher = createCipheriv(TOKEN_CYPHER, this.encryptionKey, iv);
        const encrypted = Buffer.concat([
            cipher.update(JSON.stringify(payload), 'utf8'),
            cipher.final()
        ]);

        return Buffer.from(JSON.stringify({
            iv: iv.toString('base64'),
            value: encrypted.toString('base64')
        } satisfies ContainerVncTokenEnvelope)).toString('base64');
    }

    private decrypt(token: string): ContainerVncTokenPayload {
        let envelope: unknown;
        try {
            envelope = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
        } catch {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_UNAUTHORIZED, 'Invalid VNC session token');
        }

        if (!isRecord(envelope) || typeof envelope.iv !== 'string' || typeof envelope.value !== 'string') {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_UNAUTHORIZED, 'Invalid VNC session token');
        }

        try {
            const decipher = createDecipheriv(
                TOKEN_CYPHER,
                this.encryptionKey,
                Buffer.from(envelope.iv, 'base64')
            );
            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(envelope.value, 'base64')),
                decipher.final()
            ]);
            const payload = JSON.parse(decrypted.toString('utf8'));

            if (!isContainerVncTokenPayload(payload)) {
                throw new Error('Invalid payload');
            }

            return payload;
        } catch {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_UNAUTHORIZED, 'Invalid VNC session token');
        }
    }
};
