import type { ISocketService } from '../api/entities/socket-service';
import SocketIOAdapter from './socket-io-adapter';
import TokenStorage from '@/modules/auth/services/token-storage';

type SocketAuth = Record<string, unknown>;

class SocketService implements ISocketService {
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

    on(event: string, callback: (...args: unknown[]) => void): () => void {
        return this.transport.on(event, callback);
    }

    off(event: string, callback?: (...args: unknown[]) => void): void {
        this.transport.off(event, callback);
    }

    async emit<T = unknown>(event: string, data?: unknown): Promise<T> {
        if (!this.transport.isConnected()) {
            await this.connect();
        }

        return this.transport.emit<T>(event, data);
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
}

const getInitialAuth = (): Record<string, unknown> => {
    try {
        const tokenStorage = new TokenStorage();
        const token = tokenStorage.getToken();
        return token ? { token } : {};
    } catch {
        return {};
    }
};

const socketTransport = new SocketIOAdapter(import.meta.env.VITE_API_URL, {
    auth: getInitialAuth()
});

const socketService = new SocketService(socketTransport, getInitialAuth);

export { socketTransport, socketService };
export default socketService;
