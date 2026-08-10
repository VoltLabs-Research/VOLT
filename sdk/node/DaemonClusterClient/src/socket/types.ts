/** Configures the socket.io-client control connection. */
export interface SocketOptions {
    /**
     * Whether to automatically reconnect on disconnect.
     * @default true
     */
    reconnect?: boolean;
    /**
     * Maximum number of reconnection attempts before giving up.
     * Use `Infinity` to retry forever.
     * @default Infinity
     */
    maxReconnectAttempts?: number;
    /**
     * Base delay in milliseconds for the first reconnection attempt.
     * socket.io-client applies exponential backoff up to `reconnectMaxDelayMs`.
     * @default 500
     */
    reconnectBaseDelayMs?: number;
    /**
     * Maximum delay cap in milliseconds for reconnection attempts.
     * @default 30_000
     */
    reconnectMaxDelayMs?: number;
    /**
     * Randomization factor (0–1) added to the reconnection delay to avoid
     * thundering-herd reconnection storms.
     * @default 0.3
     */
    randomizationFactor?: number;
};
