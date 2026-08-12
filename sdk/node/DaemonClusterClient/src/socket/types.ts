export interface SocketOptions {
    reconnect?: boolean;
    maxReconnectAttempts?: number;
    reconnectBaseDelayMs?: number;
    reconnectMaxDelayMs?: number;
    randomizationFactor?: number;
};
