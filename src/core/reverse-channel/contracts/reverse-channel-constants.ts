type ValueOf<T> = T[keyof T];

export type TeamClusterDaemonSessionKind = ValueOf<typeof REVERSE_CHANNEL.SessionKind>;
export type TeamClusterDaemonTerminalTarget = ValueOf<typeof REVERSE_CHANNEL.TerminalTarget>;
export type TeamClusterTunnelSessionStatus = ValueOf<typeof REVERSE_CHANNEL.TunnelSessionStatus>;

export const REVERSE_CHANNEL = Object.freeze({
    ResponseType: Object.freeze({
        Json: 'json',
        Buffer: 'buffer',
        Stream: 'stream'
    }),
    SessionKind: Object.freeze({
        Terminal: 'terminal',
        Tunnel: 'tunnel',
        WebSocket: 'websocket'
    }),
    TerminalTarget: Object.freeze({
        Container: 'container'
    }),
    TunnelSessionStatus: Object.freeze({
        Opening: 'opening',
        Open: 'open',
        Closed: 'closed'
    })
});
