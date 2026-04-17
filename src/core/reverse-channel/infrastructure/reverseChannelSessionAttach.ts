import { REVERSE_CHANNEL } from '@/contracts';
import type { TeamClusterDaemonSessionAttachPayload } from '@/contracts';

interface UnsupportedSessionAttachPayload {
    sessionId: string;
    kind: string;
};

interface WebSocketSessionAttachPayload extends TeamClusterDaemonSessionAttachPayload {
    kind: typeof REVERSE_CHANNEL.SessionKind.WebSocket;
    targetUrl: string;
    protocols?: string[];
};

interface TerminalSessionAttachPayload extends TeamClusterDaemonSessionAttachPayload {
    kind: typeof REVERSE_CHANNEL.SessionKind.Terminal;
    terminalTarget: TeamClusterDaemonSessionAttachPayload['terminalTarget'];
};

type ParsedSessionAttachPayload =
    | TerminalSessionAttachPayload
    | WebSocketSessionAttachPayload
    | UnsupportedSessionAttachPayload;

export const isTerminalSessionAttachPayload = (
    payload: ParsedSessionAttachPayload
): payload is TerminalSessionAttachPayload => {
    return payload.kind === REVERSE_CHANNEL.SessionKind.Terminal;
};

export const isWebSocketSessionAttachPayload = (
    payload: ParsedSessionAttachPayload
): payload is WebSocketSessionAttachPayload => {
    return payload.kind === REVERSE_CHANNEL.SessionKind.WebSocket;
};

export const readSessionAttachPayload = (
    payload: Record<string, unknown> | undefined
): ParsedSessionAttachPayload => {
    return payload as unknown as ParsedSessionAttachPayload;
};
