import { EventEmitter } from 'node:events';

export interface TeamClusterReverseWebSocketMessage {
    data: Buffer;
    isBinary: boolean;
};

export interface TeamClusterReverseWebSocketClosePayload {
    code?: number;
    message?: string;
};

type TeamClusterReverseWebSocketDataListener = (payload: TeamClusterReverseWebSocketMessage) => void;
type TeamClusterReverseWebSocketEndListener = (payload: TeamClusterReverseWebSocketClosePayload) => void;
type TeamClusterReverseWebSocketErrorListener = (error: Error) => void;

export class TeamClusterReverseWebSocketStream {
    private readonly emitter = new EventEmitter();
    public destroyed = false;
    public protocol?: string;

    constructor(
        private readonly onSend: (payload: TeamClusterReverseWebSocketMessage) => void,
        private readonly onDestroy: () => void
    ) {}

    send(data: Buffer | string, isBinary?: boolean): void {
        if (this.destroyed) {
            return;
        }

        const payload: TeamClusterReverseWebSocketMessage = {
            data: typeof data === 'string' ? Buffer.from(data, 'utf8') : data,
            isBinary: typeof data === 'string' ? false : isBinary ?? true
        };
        this.onSend(payload);
    }

    destroy(): void {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;
        this.emitter.removeAllListeners();
        this.onDestroy();
    }

    emitData(payload: TeamClusterReverseWebSocketMessage): void {
        if (this.destroyed) {
            return;
        }

        this.emitter.emit('data', payload);
    }

    emitEnd(payload: TeamClusterReverseWebSocketClosePayload): void {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;
        this.emitter.emit('end', payload);
        this.emitter.removeAllListeners();
    }

    emitError(error: Error): void {
        if (this.destroyed) {
            return;
        }

        this.emitter.emit('error', error);
    }

    removeAllListeners(event?: 'data' | 'end' | 'error'): void {
        if (event) {
            this.emitter.removeAllListeners(event);
            return;
        }

        this.emitter.removeAllListeners();
    }

    on(event: 'data', listener: TeamClusterReverseWebSocketDataListener): void;
    on(event: 'end', listener: TeamClusterReverseWebSocketEndListener): void;
    on(event: 'error', listener: TeamClusterReverseWebSocketErrorListener): void;
    on(
        event: 'data' | 'end' | 'error',
        listener: TeamClusterReverseWebSocketDataListener | TeamClusterReverseWebSocketEndListener | TeamClusterReverseWebSocketErrorListener
    ): void {
        this.emitter.on(event, listener);
    }
};
