import type { ReverseChannelOutboundMessage } from '@shared/contracts/channel/binary-messages';
import type { CommandResult } from '@voltstack/daemon-cluster-client';

export type SessionCommandResult = CommandResult<object | null>;

export interface SessionTransition {
    sessionId: string;
    transitionId: number;
}

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


export const createSessionAttachFailureResult = (status: number, message: string): SessionCommandResult => ({
    status,
    data: {
        status: 'error',
        message
    }
});

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
