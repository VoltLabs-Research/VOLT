import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import useThrottledSocketEmit from '@/modules/socket/hooks/use-throttled-socket-emit';
import { SOCKET_CANVAS_WORKSPACE_EVENTS } from '@/modules/socket/events/canvas';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useCallback, useEffect, useState } from 'react';

export interface WorkspaceCursor {
    userId: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    x: number;
    y: number;
    lastSeen: number;
}

interface CursorPayload {
    trajectoryId: string;
    ownerId: string;
    userId: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    x: number;
    y: number;
}

interface CursorEmitPayload {
    trajectoryId: string;
    ownerId: string;
    x: number;
    y: number;
}

interface UseWorkspaceCursorsOptions {
    trajectoryId?: string;
    ownerId?: string;
    enabled?: boolean;
    containerRef: React.RefObject<HTMLElement | null>;
}

const STALE_AFTER_MS = 3_000;
const EMIT_THROTTLE_MS = 40;
const CLEANUP_INTERVAL_MS = 1_000;

const useWorkspaceCursors = ({
    trajectoryId,
    ownerId,
    enabled = true,
    containerRef
}: UseWorkspaceCursorsOptions) => {
    const currentUser = useCurrentUser();
    const currentUserId = currentUser?._id;
    const [cursors, setCursors] = useState<Record<string, WorkspaceCursor>>({});

    const emitterEnabled = enabled && !!trajectoryId && !!ownerId && !!currentUserId;
    const cursorEmitter = useThrottledSocketEmit<CursorEmitPayload>(SOCKET_CANVAS_WORKSPACE_EVENTS.CURSOR, {
        intervalMs: EMIT_THROTTLE_MS,
        mode: 'leading-throttle',
        enabled: emitterEnabled,
        fireAndForget: true
    });

    useSocketEvent<CursorPayload>(SOCKET_CANVAS_WORKSPACE_EVENTS.CURSOR, (payload) => {
        if (!payload) return;
        if (payload.trajectoryId !== trajectoryId) return;
        if (payload.ownerId !== ownerId) return;
        if (payload.userId === currentUserId) return;

        setCursors((prev) => ({
            ...prev,
            [payload.userId]: {
                userId: payload.userId,
                firstName: payload.firstName,
                lastName: payload.lastName,
                avatar: payload.avatar,
                x: payload.x,
                y: payload.y,
                lastSeen: Date.now()
            }
        }));
    }, { enabled: emitterEnabled });

    useEffect(() => {
        if (!emitterEnabled) return;
        return () => {
            setCursors({});
        };
    }, [emitterEnabled, trajectoryId, ownerId, currentUserId]);

    useEffect(() => {
        if (!enabled) return;

        const interval = setInterval(() => {
            const now = Date.now();
            setCursors((prev) => {
                let changed = false;
                const next: Record<string, WorkspaceCursor> = {};

                for (const [key, cursor] of Object.entries(prev)) {
                    if (now - cursor.lastSeen > STALE_AFTER_MS) {
                        changed = true;
                        continue;
                    }

                    next[key] = cursor;
                }

                return changed ? next : prev;
            });
        }, CLEANUP_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [enabled]);

    useEffect(() => {
        if (!enabled || !trajectoryId || !ownerId || !currentUserId) {
            return;
        }

        const container = containerRef.current;
        if (!container) return;

        const handlePointer = (event: PointerEvent) => {
            const rect = container.getBoundingClientRect();

            if (rect.width === 0 || rect.height === 0) return;

            const x = (event.clientX - rect.left) / rect.width;
            const y = (event.clientY - rect.top) / rect.height;

            if (x < 0 || x > 1 || y < 0 || y > 1) return;

            cursorEmitter.emit({
                trajectoryId,
                ownerId,
                x,
                y
            });
        };

        container.addEventListener('pointermove', handlePointer);

        return () => {
            container.removeEventListener('pointermove', handlePointer);
        };
    }, [enabled, trajectoryId, ownerId, currentUserId, containerRef, cursorEmitter]);

    const resolveCursorPosition = useCallback((cursor: WorkspaceCursor) => {
        const container = containerRef.current;
        if (!container) {
            return null;
        }

        const rect = container.getBoundingClientRect();
        return {
            left: cursor.x * rect.width,
            top: cursor.y * rect.height
        };
    }, [containerRef]);

    return {
        cursors: Object.values(cursors),
        resolveCursorPosition
    };
};

export default useWorkspaceCursors;
