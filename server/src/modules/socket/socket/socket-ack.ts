export interface SocketAck<T = unknown> {
    ok: boolean;
    data?: T;
    error?: string;
}

export const ackOk = <T>(data?: T): SocketAck<T> => ({
    ok: true,
    data
});

export const ackError = (error: string): SocketAck<never> => ({
    ok: false,
    error
});
