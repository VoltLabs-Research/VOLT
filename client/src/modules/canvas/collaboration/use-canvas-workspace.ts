import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import useSocketRoom from '@/modules/socket/hooks/use-socket-room';
import useThrottledSocketEmit from '@/modules/socket/hooks/use-throttled-socket-emit';
import { emitOrReport } from '@/modules/socket/services/socket-emit-helpers';
import {
    SOCKET_CANVAS_LOBBY_EVENTS,
    SOCKET_CANVAS_WORKSPACE_EVENTS
} from '@/modules/socket/events/canvas';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import {
    applySharedCanvasPatch,
    selectSharedCanvasState
} from './shared-state';
import { create } from 'zustand';
import { useCallback, useEffect, useRef } from 'react';
import type { SharedCanvasState } from './shared-state';
import { useNavigate } from 'react-router-dom';
export interface WorkspacePresenceUser {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
    isAnonymous: boolean;
}

interface WorkspacePresenceState {
    lobbyUsers: WorkspacePresenceUser[];
    workspaceViewers: WorkspacePresenceUser[];
}

const usePresenceStore = create<WorkspacePresenceState>(() => ({
    lobbyUsers: [],
    workspaceViewers: []
}));

interface WorkspaceSyncPayload {
    trajectoryId: string;
    ownerId: string;
    revision: number;
    state: SharedCanvasState;
    updatedAt?: number;
}

interface WorkspacePatchPayload {
    trajectoryId: string;
    ownerId: string;
    revision: number;
    patch: SharedCanvasState;
    senderId: string;
}

interface WorkspaceClosedPayload {
    trajectoryId: string;
    ownerId: string;
}

interface WorkspacePatchEmitPayload {
    trajectoryId: string;
    ownerId: string;
    patch: SharedCanvasState;
}

interface UseCanvasWorkspaceOptions {
    trajectoryId?: string;
    ownerId?: string;
    enabled?: boolean;
}

const PUBLISH_THROTTLE_MS = 150;

const useCanvasWorkspace = ({
    trajectoryId,
    ownerId: requestedOwnerId,
    enabled = true
}: UseCanvasWorkspaceOptions) => {
    const currentUser = useCurrentUser();
    const navigate = useNavigate();

    const lobbyUsers = usePresenceStore((s) => s.lobbyUsers);
    const workspaceViewers = usePresenceStore((s) => s.workspaceViewers);

    const currentUserId = currentUser?._id;
    const effectiveOwnerId = requestedOwnerId ?? currentUserId;
    const isOwner = Boolean(currentUserId && effectiveOwnerId === currentUserId);

    const suppressBroadcastRef = useRef(false);
    const publishedStateRef = useRef<SharedCanvasState | null>(null);

    const lobbyEnabled = enabled && !!trajectoryId && !!currentUserId;
    const visitOwner = effectiveOwnerId ?? currentUserId;
    const visitEnabled = enabled && !!trajectoryId && !!currentUserId;

    useSocketRoom({
        joinEvent: SOCKET_CANVAS_LOBBY_EVENTS.JOIN,
        leaveEvent: SOCKET_CANVAS_LOBBY_EVENTS.LEAVE,
        roomKey: lobbyEnabled ? trajectoryId ?? null : null,
        buildJoinPayload: () => trajectoryId ? { trajectoryId } : null,
        enabled: lobbyEnabled,
        fireAndForget: true
    });

    useSocketRoom({
        joinEvent: SOCKET_CANVAS_WORKSPACE_EVENTS.VISIT,
        leaveEvent: SOCKET_CANVAS_WORKSPACE_EVENTS.LEAVE,
        roomKey: visitEnabled && trajectoryId && visitOwner ? `${trajectoryId}:${visitOwner}` : null,
        buildJoinPayload: () => (trajectoryId && visitOwner) ? { trajectoryId, ownerId: visitOwner } : null,
        enabled: visitEnabled,
        fireAndForget: true
    });

    useEffect(() => {
        if (!lobbyEnabled) return;
        return () => {
            usePresenceStore.setState({ lobbyUsers: [], workspaceViewers: [] });
        };
    }, [lobbyEnabled, trajectoryId, currentUserId]);

    useSocketEvent<WorkspacePresenceUser[] | undefined>(SOCKET_CANVAS_LOBBY_EVENTS.UPDATE, (users) => {
        usePresenceStore.setState({ lobbyUsers: users ?? [] });
    });

    useSocketEvent<WorkspacePresenceUser[] | undefined>(SOCKET_CANVAS_WORKSPACE_EVENTS.VIEWERS, (users) => {
        usePresenceStore.setState({ workspaceViewers: users ?? [] });
    });

    const isMatchingPayload = (payload: { trajectoryId?: string; ownerId?: string } | undefined): boolean => {
        return !!payload
            && payload.trajectoryId === trajectoryId
            && payload.ownerId === effectiveOwnerId;
    };

    useSocketEvent<WorkspaceSyncPayload | undefined>(SOCKET_CANVAS_WORKSPACE_EVENTS.SYNC_STATE, (payload) => {
        if (!isMatchingPayload(payload)) return;

        suppressBroadcastRef.current = true;
        try {
            applySharedCanvasPatch(payload!.state ?? {});
        } finally {
            suppressBroadcastRef.current = false;
        }

        publishedStateRef.current = {
            ...(publishedStateRef.current ?? {}),
            ...(payload!.state ?? {})
        };
    });

    useSocketEvent<WorkspacePatchPayload | undefined>(SOCKET_CANVAS_WORKSPACE_EVENTS.APPLY_PATCH, (payload) => {
        if (!isMatchingPayload(payload)) return;

        suppressBroadcastRef.current = true;
        try {
            applySharedCanvasPatch(payload!.patch ?? {});
        } finally {
            suppressBroadcastRef.current = false;
        }

        publishedStateRef.current = {
            ...(publishedStateRef.current ?? {}),
            ...(payload!.patch ?? {})
        };
    });

    useSocketEvent<WorkspaceClosedPayload | undefined>(SOCKET_CANVAS_WORKSPACE_EVENTS.CLOSED, (payload) => {
        if (!isMatchingPayload(payload)) return;
        if (payload!.ownerId === currentUserId) return;

        navigate(`/canvas/${payload!.trajectoryId}`, { replace: true });
    });

    useEffect(() => {
        if (!enabled || !trajectoryId || !currentUserId || !isOwner) {
            return;
        }

        publishedStateRef.current = selectSharedCanvasState(useEditorStore.getState());

        emitOrReport(SOCKET_CANVAS_WORKSPACE_EVENTS.PUBLISH_SNAPSHOT, {
            trajectoryId,
            ownerId: currentUserId,
            state: publishedStateRef.current
        });
    }, [enabled, trajectoryId, currentUserId, isOwner]);

    const patchEmitter = useThrottledSocketEmit<WorkspacePatchEmitPayload>(SOCKET_CANVAS_WORKSPACE_EVENTS.PATCH, {
        intervalMs: PUBLISH_THROTTLE_MS,
        mode: 'trailing-throttle',
        enabled: enabled && !!trajectoryId && !!currentUserId,
        fireAndForget: false,
        flushOnUnmount: true
    });

    useEffect(() => {
        if (!enabled || !trajectoryId || !currentUserId) {
            return;
        }

        if (!isOwner) return;

        const unsubscribe = useEditorStore.subscribe(() => {
            if (suppressBroadcastRef.current) return;

            const full = selectSharedCanvasState(useEditorStore.getState());
            publishedStateRef.current = full;

            patchEmitter.emit({
                trajectoryId,
                ownerId: currentUserId,
                patch: full
            });
        });

        return unsubscribe;
    }, [enabled, trajectoryId, currentUserId, isOwner, patchEmitter]);

    const navigateToWorkspace = useCallback((peerId: string) => {
        if (!trajectoryId) return;

        if (peerId === currentUserId) {
            navigate(`/canvas/${trajectoryId}`);
            return;
        }

        navigate(`/canvas/${trajectoryId}/workspace/${peerId}`);
    }, [trajectoryId, currentUserId, navigate]);

    const peersInLobby = lobbyUsers.filter((user) => user.id !== currentUserId);
    const collaborationOwner = !isOwner && effectiveOwnerId
        ? lobbyUsers.find((user) => user.id === effectiveOwnerId)
        : undefined;

    return {
        lobbyUsers,
        peersInLobby,
        workspaceViewers,
        collaborationOwner,
        ownerId: effectiveOwnerId,
        isOwner,
        readOnly: !isOwner,
        navigateToWorkspace
    };
};

export default useCanvasWorkspace;
