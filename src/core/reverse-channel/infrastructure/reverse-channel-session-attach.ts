import { REVERSE_CHANNEL } from '@/core/reverse-channel/contracts/reverse-channel-constants';
import type {
    TeamClusterDaemonSessionAttachPayload,
    TeamClusterDaemonTerminalSessionAttachPayload,
    TeamClusterDaemonWebSocketSessionAttachPayload
} from '@/core/reverse-channel/contracts/reverse-channel-socket';

type UnsupportedSessionAttachPayload = Pick<TeamClusterDaemonSessionAttachPayload, 'sessionId'> & {
    kind: string;
};

type ParsedSessionAttachPayload =
    | TeamClusterDaemonTerminalSessionAttachPayload
    | TeamClusterDaemonWebSocketSessionAttachPayload
    | UnsupportedSessionAttachPayload;

export const isTerminalSessionAttachPayload = (
    payload: ParsedSessionAttachPayload
): payload is TeamClusterDaemonTerminalSessionAttachPayload => {
    return payload.kind === REVERSE_CHANNEL.SessionKind.Terminal;
};

export const isWebSocketSessionAttachPayload = (
    payload: ParsedSessionAttachPayload
): payload is TeamClusterDaemonWebSocketSessionAttachPayload => {
    return payload.kind === REVERSE_CHANNEL.SessionKind.WebSocket;
};

export const readSessionAttachPayload = (
    payload: object | undefined
): ParsedSessionAttachPayload => {
    return payload as ParsedSessionAttachPayload;
};
