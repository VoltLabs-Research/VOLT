/** Configuration options for the `HeartbeatManager`. */
export interface HeartbeatOptions {
    /**
     * Interval in milliseconds between heartbeat sends.
     * @default 30_000
     */
    interval?: number;
    /**
     * Random jitter in milliseconds added to each interval to avoid
     * synchronized heartbeat storms from multiple daemon instances.
     * The actual delay is `interval + random(0, jitter)`.
     * @default 0
     */
    jitter?: number;
    /**
     * Factory called before each heartbeat to build the payload.
     * Receives no arguments; close over `ClusterDaemonClient` to include
     * dynamic values like metrics or the current `daemonPassword`.
     *
     * If omitted, an empty object is sent as the payload.
     */
    payloadFactory?: () => object | Promise<object>;
};
