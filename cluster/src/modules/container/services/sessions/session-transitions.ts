import type { ReverseChannelOutboundMessage } from '@shared/contracts/channel/binary-messages';
import type { CommandResult } from '@voltstack/daemon-cluster-client';

export type SessionCommandResult = CommandResult<object | null>;

export interface SessionTransition {
    sessionId: string;
    transitionId: number;
}

/**
 * Bookkeeping the ReverseChannelBridge owns on behalf of the per-kind session
 * managers: a session id may only be attaching once at a time, idle sessions
 * expire out of one shared activity cache, and every manager emits through the
 * same outbound channel.
 */
export interface SessionTransitionCoordinator {
    beginSessionTransition(sessionId: string): SessionTransition | null;
    endSessionTransition(transition: SessionTransition): void;
    wasSessionTransitionCancelled(transition: SessionTransition): boolean;
    cleanupInteractiveSession(sessionId: string): void;
    touchSession(sessionId: string): void;
    forgetSessionActivity(sessionId: string): void;
    clearSessionActivityIfUntracked(sessionId: string): void;
    emitMessage(message: ReverseChannelOutboundMessage): void;
}


/** The envelope every failed `session.attach` answers with. */
export const createSessionAttachFailureResult = (status: number, message: string): SessionCommandResult => ({
    status,
    data: {
        status: 'error',
        message
    }
});

/** Tells the peer the session is over before answering the attach command with the same reason. */
export const failSessionAttach = (
    coordinator: SessionTransitionCoordinator,
    sessionId: string,
    status: number,
    message: string
): SessionCommandResult => {
    coordinator.emitMessage({
        type: 'session-end',
        sessionId,
        error: message
    });

    return createSessionAttachFailureResult(status, message);
};
