declare module 'guacamole-lite' {
    import type { Server as HttpServer } from 'node:http';
    import type { WebSocketServer } from 'ws';

    interface GuacamoleLiteWsOptions {
        server: HttpServer;
        path?: string;
    };

    interface GuacamoleLiteGuacdOptions {
        host?: string;
        port?: number;
    };

    interface GuacamoleLiteClientOptions {
        crypt: {
            cypher: string;
            key: Buffer;
        };
        maxInactivityTime?: number;
        log?: {
            level?: string | number;
            stdLog?: (message: string) => void;
            errorLog?: (message: string) => void;
        };
    };

    interface GuacamoleLiteCallbacks {
        processConnectionSettings?: (
            settings: unknown,
            callback: (error?: Error | null, settings?: unknown) => void
        ) => void;
    };

    class GuacamoleLite {
        webSocketServer: WebSocketServer;
        constructor(
            wsOptions: GuacamoleLiteWsOptions,
            guacdOptions: GuacamoleLiteGuacdOptions,
            clientOptions: GuacamoleLiteClientOptions,
            callbacks?: GuacamoleLiteCallbacks
        );
        close(): void;
    }

    export = GuacamoleLite;
}
