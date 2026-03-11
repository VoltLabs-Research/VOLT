import logger from '@shared/infrastructure/logger';
import GuacamoleLite from 'guacamole-lite';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { injectable } from 'tsyringe';

interface ContainerXrdpRdpConnectionSettings {
    hostname: string;
    port: number;
    username: string;
    password: string;
    width: number;
    height: number;
    dpi: number;
    security: 'any';
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

const isContainerXrdpTokenPayload = (value: unknown): value is ContainerXrdpTokenPayload => {
    if (!isRecord(value) || !isRecord(value.connection) || !isRecord(value.meta)) {
        return false;
    }

    if (value.connection.type !== 'rdp' || !isRecord(value.connection.settings)) {
        return false;
    }

    return value.meta.type === 'container-xrdp'
        && typeof value.meta.teamId === 'string'
        && typeof value.meta.containerId === 'string'
        && typeof value.meta.userId === 'string'
        && typeof value.meta.expiresAt === 'number';
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
    private guacamoleServer: GuacamoleLite | null = null;

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
                stdLog: (message: string) => logger.info(message),
                errorLog: (message: string) => logger.error(message)
            }
        }, callbacks);
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
                    security: 'any',
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

        return {
            token: this.encrypt(payload),
            websocketPath: XRDP_TUNNEL_PATH,
            expiresAt: new Date(expiresAt).toISOString()
        };
    }

    private processConnectionSettings(settings: unknown, callback: ProcessConnectionSettingsCallback): void {
        if (!isContainerXrdpTokenPayload(settings)) {
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
