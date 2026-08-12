export interface HeartbeatOptions {
    interval?: number;
    jitter?: number;
    payloadFactory?: () => object | Promise<object>;
};
