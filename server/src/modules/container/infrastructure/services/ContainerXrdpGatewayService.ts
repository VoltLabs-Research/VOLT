import logger from '@shared/infrastructure/logger';
import GuacamoleLite from 'guacamole-lite';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { Socket } from 'node:net';
import type { Duplex } from 'node:stream';
import { injectable } from 'tsyringe';

interface ContainerXrdpRdpConnectionSettings {
    hostname: string;
    port: number;
    username: string;
    password: string;
    width: number;
    height: number;
    dpi: number;
    security: 'tls' | 'rdp' | 'nla' | 'any';
    'ignore-cert': true;
    'enable-wallpaper': false;
    'enable-theming': false;
    'enable-font-smoothing': true;
    'resize-method': 'display-update';
};

interface ContainerXrdpTokenMetadata {
    type: 'container-xrdp';
    teamId: string;
    containerId: string;
    userId: string;
    expiresAt: number;
};

interface ContainerXrdpTokenPayload {
    connection: {
        type: 'rdp';
        settings: ContainerXrdpRdpConnectionSettings;
    };
    meta: ContainerXrdpTokenMetadata;
};

interface ContainerXrdpResolvedPayload {
    connection: ContainerXrdpRdpConnectionSettings;
    meta: ContainerXrdpTokenMetadata;
};

interface CreateContainerXrdpSessionInput {
    teamId: string;
    containerId: string;
    userId: string;
    host: string;
    port: number;
    username: string;
    password: string;
    width?: number;
    height?: number;
    dpi?: number;
};

interface ProcessConnectionSettingsCallback {
    (error?: Error | null, settings?: unknown): void;
};

interface GuacamoleLiteCallbacks {
    processConnectionSettings: (settings: unknown, callback: ProcessConnectionSettingsCallback) => void;
};

export interface ContainerXrdpSessionDescriptor {
    token: string;
    websocketPath: string;
    expiresAt: string;
};

const XRDP_TUNNEL_PATH = '/api/container-xrdp/tunnel';
const TOKEN_CYPHER = 'aes-256-cbc';
const DEFAULT_GUACD_HOST = '127.0.0.1';
const DEFAULT_GUACD_PORT = 4822;
const DEFAULT_SESSION_TTL_MS = 120_000;
const DEFAULT_MAX_INACTIVITY_MS = 300_000;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_DPI = 96;
const GUACD_REACHABILITY_TIMEOUT_MS = 1_000;
const DEFAULT_XRDP_SECURITY_MODE: ContainerXrdpRdpConnectionSettings['security'] = 'tls';

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

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isContainerXrdpMeta = (value: unknown): value is ContainerXrdpTokenMetadata => {
    if (!isRecord(value)) {
        return false;
    }

    return value.type === 'container-xrdp'
        && typeof value.teamId === 'string'
        && typeof value.containerId === 'string'
        && typeof value.userId === 'string'
        && typeof value.expiresAt === 'number';
};

const isContainerXrdpConnectionSettings = (value: unknown): value is ContainerXrdpRdpConnectionSettings => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.hostname === 'string'
        && typeof value.port === 'number'
        && typeof value.username === 'string'
        && typeof value.password === 'string';
};

const isContainerXrdpTokenPayload = (value: unknown): value is ContainerXrdpTokenPayload => {
    if (!isRecord(value) || !isRecord(value.connection) || !isContainerXrdpMeta(value.meta)) {
        return false;
    }

    return value.connection.type === 'rdp' && isContainerXrdpConnectionSettings(value.connection.settings);
};

const isContainerXrdpResolvedPayload = (value: unknown): value is ContainerXrdpResolvedPayload => {
    if (!isRecord(value) || !isContainerXrdpMeta(value.meta)) {
        return false;
    }

    return isContainerXrdpConnectionSettings(value.connection);
};

const getSecretKey = (): Buffer => {
    const secret = process.env.SECRET_KEY?.trim();
    if (!secret) {
        throw new Error('SECRET_KEY is required to initialize XRDP sessions');
    }

    return createHash('sha256').update(secret).digest();
};

@injectable()
export class ContainerXrdpGatewayService {
    private readonly encryptionKey = getSecretKey();
    private readonly guacdHost = process.env.GUACD_HOST || DEFAULT_GUACD_HOST;
    private readonly guacdPort = readNumberEnv('GUACD_PORT', DEFAULT_GUACD_PORT);
    private readonly sessionTtlMs = readNumberEnv('CONTAINER_XRDP_SESSION_TTL_MS', DEFAULT_SESSION_TTL_MS);
    private readonly maxInactivityTimeMs = readNumberEnv('CONTAINER_XRDP_MAX_INACTIVITY_MS', DEFAULT_MAX_INACTIVITY_MS);
    private readonly xrdpSecurityMode = this.readSecurityMode();
    private guacamoleServer: GuacamoleLite | null = null;

    private formatLogMessage(...parts: unknown[]): string {
        return parts
            .filter((part) => part !== undefined)
            .map((part) => {
                if (part instanceof Error) {
                    return part.stack || part.message;
                }

                if (typeof part === 'string') {
                    return part;
                }

                return String(part);
            })
            .join(' ');
    }

    private readSecurityMode(): ContainerXrdpRdpConnectionSettings['security'] {
        const value = process.env.XRDP_SECURITY_MODE?.trim().toLowerCase();
        if (!value) {
            return DEFAULT_XRDP_SECURITY_MODE;
        }

        if (value === 'tls' || value === 'rdp' || value === 'nla' || value === 'any') {
            return value;
        }

        throw new Error(`XRDP_SECURITY_MODE must be one of: tls, rdp, nla, any`);
    }

    public attach(server: HttpServer): void {
        if (this.guacamoleServer) {
            return;
        }

        const callbacks: GuacamoleLiteCallbacks = {
            processConnectionSettings: (settings, callback) => {
                this.processConnectionSettings(settings, callback);
            }
        };

        this.guacamoleServer = new GuacamoleLite({
            server,
            path: XRDP_TUNNEL_PATH
        }, {
            host: this.guacdHost,
            port: this.guacdPort
        }, {
            crypt: {
                cypher: TOKEN_CYPHER,
                key: this.encryptionKey
            },
            maxInactivityTime: this.maxInactivityTimeMs,
            log: {
                level: 'ERRORS',
                stdLog: (...messages: unknown[]) => logger.info(this.formatLogMessage(...messages)),
                errorLog: (...messages: unknown[]) => logger.error(this.formatLogMessage(...messages))
            }
        }, callbacks);

        // The ws WebSocketServer auto-registers an `upgrade` listener that
        // rejects non-matching paths with 400, which kills Socket.IO WebSocket
        // handshakes. Replace it with a listener that silently skips
        // non-matching paths so other upgrade handlers (Socket.IO) can proceed.
        const wss = this.guacamoleServer.webSocketServer;
        const removeAutoListeners = (wss as { _removeListeners?: () => void })._removeListeners;
        if (typeof removeAutoListeners === 'function') {
            removeAutoListeners();
        }

        server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
            if (!this.isXrdpUpgradeRequest(request)) {
                return;
            }

            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        });
    }

    public isXrdpUpgradeRequest(request: IncomingMessage): boolean {
        const url = request.url || '';
        const pathname = url.indexOf('?') !== -1 ? url.slice(0, url.indexOf('?')) : url;
        return pathname === XRDP_TUNNEL_PATH;
    }

    public async ensureGatewayAvailable(): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            const socket = new Socket();
            let settled = false;

            const finalize = (error?: Error): void => {
                if (settled) {
                    return;
                }

                settled = true;
                socket.removeAllListeners();
                socket.destroy();

                if (error) {
                    logger.error({
                        action: 'container.xrdp.guacd.unreachable',
                        error,
                        guacdHost: this.guacdHost,
                        guacdPort: this.guacdPort,
                        timeoutMs: GUACD_REACHABILITY_TIMEOUT_MS
                    }, 'Failed XRDP guacd reachability preflight');
                    reject(error);
                    return;
                }

                resolve();
            };

            socket.setTimeout(GUACD_REACHABILITY_TIMEOUT_MS);
            socket.once('connect', () => finalize());
            socket.once('timeout', () => {
                finalize(new Error(`Timed out connecting to guacd at ${this.guacdHost}:${this.guacdPort}`));
            });
            socket.once('error', (error: Error) => finalize(error));
            socket.connect(this.guacdPort, this.guacdHost);
        });
    }

    public createSession(input: CreateContainerXrdpSessionInput): ContainerXrdpSessionDescriptor {
        const expiresAt = Date.now() + this.sessionTtlMs;
        const payload: ContainerXrdpTokenPayload = {
            connection: {
                type: 'rdp',
                settings: {
                    hostname: input.host,
                    port: input.port,
                    username: input.username,
                    password: input.password,
                    width: input.width || DEFAULT_WIDTH,
                    height: input.height || DEFAULT_HEIGHT,
                    dpi: input.dpi || DEFAULT_DPI,
                    security: this.xrdpSecurityMode,
                    'ignore-cert': true,
                    'enable-wallpaper': false,
                    'enable-theming': false,
                    'enable-font-smoothing': true,
                    'resize-method': 'display-update'
                }
            },
            meta: {
                type: 'container-xrdp',
                teamId: input.teamId,
                containerId: input.containerId,
                userId: input.userId,
                expiresAt
            }
        };

        logger.info({
            action: 'container.xrdp.session.created',
            teamId: input.teamId,
            containerId: input.containerId,
            userId: input.userId,
            hostname: payload.connection.settings.hostname,
            port: payload.connection.settings.port,
            security: payload.connection.settings.security,
            expiresAt: new Date(expiresAt).toISOString()
        }, 'Created XRDP session target');

        return {
            token: this.encrypt(payload),
            websocketPath: XRDP_TUNNEL_PATH,
            expiresAt: new Date(expiresAt).toISOString()
        };
    }

    private processConnectionSettings(settings: unknown, callback: ProcessConnectionSettingsCallback): void {
        if (!isContainerXrdpTokenPayload(settings) && !isContainerXrdpResolvedPayload(settings)) {
            callback(new Error('Invalid XRDP session token'));
            return;
        }

        if (settings.meta.expiresAt < Date.now()) {
            callback(new Error('XRDP session token expired'));
            return;
        }

        callback(null, settings);
    }

    private encrypt(payload: ContainerXrdpTokenPayload): string {
        const iv = randomBytes(16);
        const cipher = createCipheriv(TOKEN_CYPHER, this.encryptionKey, iv);
        const encrypted = Buffer.concat([
            cipher.update(JSON.stringify(payload), 'utf8'),
            cipher.final()
        ]);

        return Buffer.from(JSON.stringify({
            iv: iv.toString('base64'),
            value: encrypted.toString('base64')
        })).toString('base64');
    }
};
