import { REVERSE_CHANNEL } from '@/core/reverse-channel/contracts/reverseChannel.constants';
import type { TeamClusterDaemonSessionAttachPayload } from '@/core/reverse-channel/contracts/reverseChannel.socket';

interface UnsupportedSessionAttachPayload {
    sessionId: string;
    kind: string;
}
interface WebSocketSessionAttachPayload extends TeamClusterDaemonSessionAttachPayload {
    kind: 'websocket';
    targetUrl: string;
    protocols?: string[];
}
interface TerminalSessionAttachPayload extends TeamClusterDaemonSessionAttachPayload {
    kind: 'terminal';
    terminalTarget: TeamClusterDaemonSessionAttachPayload['terminalTarget'];
}
type ParsedSessionAttachPayload =
    | TerminalSessionAttachPayload
    | WebSocketSessionAttachPayload
    | UnsupportedSessionAttachPayload

export const isTerminalSessionAttachPayload = (
    payload: ParsedSessionAttachPayload
): payload is TerminalSessionAttachPayload => {
    return payload.kind === REVERSE_CHANNEL.SessionKind.Terminal;
}

export const isWebSocketSessionAttachPayload = (
    payload: ParsedSessionAttachPayload
): payload is WebSocketSessionAttachPayload => {
    return payload.kind === REVERSE_CHANNEL.SessionKind.WebSocket;
}

export const readSessionAttachPayload = (
    payload: object | undefined
): ParsedSessionAttachPayload => {
    return payload as ParsedSessionAttachPayload;
}
