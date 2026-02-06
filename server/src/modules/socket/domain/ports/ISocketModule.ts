/**
 * Interface representing a socket connection.
 */
export interface ISocketConnection {
    /** Unique identifier for this socket connection */
    readonly id: string;

    /** User ID if authenticated, undefined for anonymous connections */
    readonly userId?: string;

    /** User object if authenticated */
    readonly user?: {
        _id: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        avatar?: string;
        teams?: string[];
    };

    /** Custom data attached to this connection */
    data: Record<string, any>;

    /** Rooms this socket has joined */
    readonly rooms: Set<string>;

    /** Native socket object */
    nativeSocket?: any;
};

/**
 * Base interface that all socket modules must implement.
 */
export interface ISocketModule {
    /** Unique name identifier for this module */
    readonly name: string;

    /**
     * Called once when the module is registered with the gateway.
     * Use for initialization that doesn't depend on individual connections.
     */
    onInit(): void | Promise<void>;

    /**
     * Called for each new socket connection.
     * @param connection - Abstracted socket connection
     */
    onConnection(connection: ISocketConnection): void;

    /**
     * Called during graceful shutdown.
     * Use for cleanup of resources, intervals, subscriptions, etc.
     */
    onShutdown(): Promise<void>;
};
