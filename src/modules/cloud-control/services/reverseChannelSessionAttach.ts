import { REVERSE_CHANNEL } from '@/shared/contracts';
import type { TeamClusterDaemonSessionAttachPayload } from '@/shared/contracts';

interface UnsupportedSessionAttachPayload {
    sessionId: string;
    kind: string;
};

interface WebSocketSessionAttachPayload extends TeamClusterDaemonSessionAttachPayload {
    kind: typeof REVERSE_CHANNEL.SessionKind.WebSocket;
    targetUrl: string;
};

interface TerminalSessionAttachPayload extends TeamClusterDaemonSessionAttachPayload {
    kind: typeof REVERSE_CHANNEL.SessionKind.Terminal;
    terminalTarget: TeamClusterDaemonSessionAttachPayload['terminalTarget'];
};

export type ParsedSessionAttachPayload =
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

const isValidWebSocketTargetUrl = (targetUrl: string): boolean => {
    try {
        const parsedTargetUrl = new URL(targetUrl);

        if (parsedTargetUrl.protocol !== 'ws:' && parsedTargetUrl.protocol !== 'wss:') {
            return false;
        }

        if (parsedTargetUrl.username.length > 0 || parsedTargetUrl.password.length > 0) {
            return false;
        }

        return parsedTargetUrl.hash.length === 0;
    } catch {
        return false;
    }
};

export const readSessionAttachPayload = (
    payload: Record<string, unknown> | undefined
): ParsedSessionAttachPayload | null => {
    if (!payload || typeof payload.sessionId !== 'string' || typeof payload.kind !== 'string') {
        return null;
    }

    const sessionId = payload.sessionId.trim();
    if (sessionId.length === 0) {
        return null;
    }

    if (payload.kind === REVERSE_CHANNEL.SessionKind.WebSocket) {
        if (typeof payload.targetUrl !== 'string') {
            return null;
        }

        const targetUrl = payload.targetUrl.trim();
        if (targetUrl.length === 0 || !isValidWebSocketTargetUrl(targetUrl)) {
            return null;
        }

        return {
            sessionId,
            kind: payload.kind,
            targetUrl
        };
    }

    if (payload.kind !== REVERSE_CHANNEL.SessionKind.Terminal) {
        return {
            sessionId,
            kind: payload.kind
        };
    }

    let containerId: string | undefined;
    if (typeof payload.containerId !== 'undefined') {
        if (typeof payload.containerId !== 'string') {
            return null;
        }

        containerId = payload.containerId.trim();
        if (containerId.length === 0) {
            return null;
        }
    }

    if (
        typeof payload.terminalTarget !== 'undefined'
        && payload.terminalTarget !== REVERSE_CHANNEL.TerminalTarget.Host
        && payload.terminalTarget !== REVERSE_CHANNEL.TerminalTarget.Container
    ) {
        return null;
    }

    return {
        sessionId,
        kind: payload.kind,
        terminalTarget: payload.terminalTarget === REVERSE_CHANNEL.TerminalTarget.Host
            ? REVERSE_CHANNEL.TerminalTarget.Host
            : REVERSE_CHANNEL.TerminalTarget.Container,
        ...(typeof containerId === 'string' ? { containerId } : {})
    };
};
