import SocketIOAdapter from './socket-io-adapter';
import { tokenStorage } from '@/shared/auth/token-storage';
import { createSocketTraceAuth } from '@/app/core/http/utilities/client-instrumentation';
import { getBackendOrigin } from '@/app/core/http/utilities/backend-origin';
import { SocketConnectionStatus } from '@/modules/socket/socket-connection-status';
import type { ISocketService } from './contracts/socket-service';

type SocketAuth = Record<string, unknown>;

class SocketUnavailableError extends Error {
    code = 'Socket::Unavailable';

    constructor(message: string, readonly cause?: unknown) {
        super(message);
        this.name = 'SocketUnavailableError';
    }
}

class SocketService implements ISocketService {
    private static readonly EMIT_WAIT_TIMEOUT_MS = 5_000;

    private authOverrides: SocketAuth = {};
    private appliedAuth: SocketAuth = {};
    private connectPromise: Promise<void> | null = null;

    constructor(
        private readonly transport: ISocketService,
        private readonly getAuth: () => SocketAuth
    ) {}

    connect(): Promise<void> {
        this.syncAuth();

        if (this.transport.isConnected()) {
            return Promise.resolve();
        }

        if (!this.connectPromise) {
            this.connectPromise = this.transport.connect().finally(() => {
                this.connectPromise = null;
            });
        }

        return this.connectPromise;
    }

    disconnect(): void {
        this.transport.disconnect();
    }

    isConnected(): boolean {
        return this.transport.isConnected();
    }

    getConnectionStatus(): SocketConnectionStatus {
        return this.transport.getConnectionStatus();
    }

    on<TArgs extends unknown[]>(event: string, callback: (...args: TArgs) => void): () => void;
    on(event: string, callback: (...args: unknown[]) => void): () => void {
        return this.transport.on(event, callback);
    }

    off<TArgs extends unknown[]>(event: string, callback?: (...args: TArgs) => void): void;
    off(event: string, callback?: (...args: unknown[]) => void): void {
        this.transport.off(event, callback);
    }

    async emit<T = unknown>(event: string, data?: unknown): Promise<T> {
        try {
            await this.ensureConnectedForEmit(event);
            return await this.transport.emit<T>(event, data);
        } catch (error) {
            if (error instanceof SocketUnavailableError) {
                throw error;
            }

            if (error instanceof Error && error.message === 'Socket is not connected') {
                throw this.createUnavailableError(event, this.transport.getConnectionStatus(), error);
            }

            throw error;
        }
    }

    emitWithoutAck(event: string, data?: unknown): void {
        this.syncAuth();

        if (!this.transport.isConnected()) {
            this.connect().catch(() => undefined);
            return;
        }

        this.transport.emitWithoutAck(event, data);
    }

    updateAuth(auth: SocketAuth): void {
        this.authOverrides = this.normalizeAuth({
            ...this.authOverrides,
            ...auth
        });

        this.syncAuth();
    }

    onConnectionChange(listener: (connected: boolean) => void): () => void {
        return this.transport.onConnectionChange(listener);
    }

    onConnectionStatusChange(listener: (status: SocketConnectionStatus) => void): () => void {
        return this.transport.onConnectionStatusChange(listener);
    }

    private syncAuth(): void {
        const nextAuth = this.normalizeAuth({
            ...this.getAuth(),
            ...this.authOverrides
        });

        if (this.isSameAuth(this.appliedAuth, nextAuth)) {
            return;
        }

        this.appliedAuth = nextAuth;
        this.transport.updateAuth(nextAuth);
    }

    private normalizeAuth(auth: SocketAuth): SocketAuth {
        return Object.fromEntries(
            Object.entries(auth).filter(([, value]) => value !== undefined)
        );
    }

    private isSameAuth(previousAuth: SocketAuth, nextAuth: SocketAuth): boolean {
        const previousKeys = Object.keys(previousAuth);
        const nextKeys = Object.keys(nextAuth);

        if (previousKeys.length !== nextKeys.length) {
            return false;
        }

        return previousKeys.every((key) => previousAuth[key] === nextAuth[key]);
    }

    private async ensureConnectedForEmit(event: string): Promise<void> {
        if (this.transport.isConnected()) {
            return;
        }

        const status = this.transport.getConnectionStatus();
        const timeoutError = this.createUnavailableError(event, status);
        let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

        try {
            await Promise.race([
                this.connect(),
                new Promise<never>((_, reject) => {
                    timeoutId = globalThis.setTimeout(() => {
                        reject(timeoutError);
                    }, SocketService.EMIT_WAIT_TIMEOUT_MS);
                })
            ]);
        } catch (error) {
            throw error instanceof SocketUnavailableError
                ? error
                : this.createUnavailableError(event, status, error);
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }

        if (!this.transport.isConnected()) {
            throw this.createUnavailableError(event, this.transport.getConnectionStatus());
        }
    }

    private createUnavailableError(event: string, status: SocketConnectionStatus, cause?: unknown): SocketUnavailableError {
        const state = status === SocketConnectionStatus.Reconnecting
            ? 'reconnecting'
            : 'offline';

        return new SocketUnavailableError(`Socket unavailable while emitting "${event}" (${state}).`, cause);
    }
};

const getInitialAuth = (): Record<string, unknown> => {
    try {
        const token = tokenStorage.getToken();
        return {
            ...createSocketTraceAuth(),
            ...(token ? { token } : {})
        };
    } catch {
        return createSocketTraceAuth();
    }
};

const socketTransport = new SocketIOAdapter(getBackendOrigin(), {
    auth: getInitialAuth(),
    autoConnect: false
});

const socketService = new SocketService(socketTransport, getInitialAuth);

export default socketService;
