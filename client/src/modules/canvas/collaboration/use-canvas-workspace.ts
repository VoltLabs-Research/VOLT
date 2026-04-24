import useSocket from '@/modules/socket/core/hooks/use-socket';
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
    const socketService = useSocket();
    const currentUser = useCurrentUser();
    const navigate = useNavigate();

    const lobbyUsers = usePresenceStore((s) => s.lobbyUsers);
    const workspaceViewers = usePresenceStore((s) => s.workspaceViewers);

    const currentUserId = currentUser?._id;
    const effectiveOwnerId = requestedOwnerId ?? currentUserId;
    const isOwner = Boolean(currentUserId && effectiveOwnerId === currentUserId);

    const suppressBroadcastRef = useRef(false);
    const publishedStateRef = useRef<SharedCanvasState | null>(null);
    const publishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ownerIdRef = useRef(effectiveOwnerId);
    const trajectoryIdRef = useRef(trajectoryId);
    const isOwnerRef = useRef(isOwner);

    ownerIdRef.current = effectiveOwnerId;
    trajectoryIdRef.current = trajectoryId;
    isOwnerRef.current = isOwner;

    useEffect(() => {
        if (!enabled || !trajectoryId || !currentUserId) {
            return;
        }

        socketService.connect().catch(() => undefined);
        socketService.emit('canvas.lobby.join', { trajectoryId }).catch(() => undefined);

        return () => {
            socketService.emit('canvas.lobby.leave', { trajectoryId }).catch(() => undefined);
            usePresenceStore.setState({ lobbyUsers: [], workspaceViewers: [] });
        };
    }, [enabled, trajectoryId, currentUserId, socketService]);

    useEffect(() => {
        if (!enabled || !trajectoryId || !currentUserId) {
            return;
        }

        const visitOwner = effectiveOwnerId ?? currentUserId;
        socketService.emit('canvas.workspace.visit', { trajectoryId, ownerId: visitOwner }).catch(() => undefined);

        return () => {
            socketService.emit('canvas.workspace.leave', { trajectoryId, ownerId: visitOwner }).catch(() => undefined);
        };
    }, [enabled, trajectoryId, effectiveOwnerId, currentUserId, socketService]);

    useEffect(() => {
        const unsubLobby = socketService.on('canvas.lobby.update', (users) => {
            usePresenceStore.setState({ lobbyUsers: (users ?? []) as WorkspacePresenceUser[] });
        });

        const unsubViewers = socketService.on('canvas.workspace.viewers', (users) => {
            usePresenceStore.setState({ workspaceViewers: (users ?? []) as WorkspacePresenceUser[] });
        });

        const unsubSync = socketService.on('canvas.workspace.sync_state', (data) => {
            const payload = data as WorkspaceSyncPayload | undefined;
            if (!payload) return;
            if (payload.trajectoryId !== trajectoryIdRef.current) return;
            if (payload.ownerId !== ownerIdRef.current) return;

            suppressBroadcastRef.current = true;
            try {
                applySharedCanvasPatch(payload.state ?? {});
            } finally {
                suppressBroadcastRef.current = false;
            }

            publishedStateRef.current = {
                ...(publishedStateRef.current ?? {}),
                ...(payload.state ?? {})
            };
        });

        const unsubPatch = socketService.on('canvas.workspace.apply_patch', (data) => {
            const payload = data as WorkspacePatchPayload | undefined;
            if (!payload) return;
            if (payload.trajectoryId !== trajectoryIdRef.current) return;
            if (payload.ownerId !== ownerIdRef.current) return;

            suppressBroadcastRef.current = true;
            try {
                applySharedCanvasPatch(payload.patch ?? {});
            } finally {
                suppressBroadcastRef.current = false;
            }

            publishedStateRef.current = {
                ...(publishedStateRef.current ?? {}),
                ...(payload.patch ?? {})
            };
        });

        const unsubClosed = socketService.on('canvas.workspace.closed', (data) => {
            const payload = data as WorkspaceClosedPayload | undefined;
            if (!payload) return;
            if (payload.trajectoryId !== trajectoryIdRef.current) return;
            if (payload.ownerId !== ownerIdRef.current) return;
            if (payload.ownerId === currentUserId) return;

            navigate(`/canvas/${payload.trajectoryId}`, { replace: true });
        });

        return () => {
            unsubLobby();
            unsubViewers();
            unsubSync();
            unsubPatch();
            unsubClosed();
        };
    }, [socketService, currentUserId, navigate]);

    useEffect(() => {
        if (!enabled || !trajectoryId || !currentUserId || !isOwner) {
            return;
        }

        publishedStateRef.current = selectSharedCanvasState(useEditorStore.getState());

        socketService.emit('canvas.workspace.publish_snapshot', {
            trajectoryId,
            ownerId: currentUserId,
            state: publishedStateRef.current
        }).catch(() => undefined);
    }, [enabled, trajectoryId, currentUserId, isOwner, socketService]);

    useEffect(() => {
        if (!enabled || !trajectoryId || !currentUserId) {
            return;
        }

        const publishPatchIfOwner = () => {
            if (!isOwnerRef.current) {
                return;
            }

            const activeTrajectoryId = trajectoryIdRef.current;
            if (!activeTrajectoryId) {
                return;
            }

            const full = selectSharedCanvasState(useEditorStore.getState());
            publishedStateRef.current = full;

            socketService.emit('canvas.workspace.patch', {
                trajectoryId: activeTrajectoryId,
                ownerId: currentUserId,
                patch: full
            }).catch(() => undefined);
        };

        const schedulePublish = () => {
            if (publishTimeoutRef.current) {
                return;
            }

            publishTimeoutRef.current = setTimeout(() => {
                publishTimeoutRef.current = null;
                publishPatchIfOwner();
            }, PUBLISH_THROTTLE_MS);
        };

        const unsubscribe = useEditorStore.subscribe(() => {
            if (suppressBroadcastRef.current) return;
            if (!isOwnerRef.current) return;

            schedulePublish();
        });

        return () => {
            unsubscribe();
            if (publishTimeoutRef.current) {
                clearTimeout(publishTimeoutRef.current);
                publishTimeoutRef.current = null;
            }
        };
    }, [enabled, trajectoryId, currentUserId, socketService]);

    const navigateToWorkspace = useCallback((peerId: string) => {
        if (!trajectoryId) return;

        if (peerId === currentUserId) {
            navigate(`/canvas/${trajectoryId}`);
            return;
        }

        navigate(`/canvas/${trajectoryId}/workspace/${peerId}`);
    }, [trajectoryId, currentUserId, navigate]);

    const peersInLobby = lobbyUsers.filter((user) => user.id !== currentUserId);

    return {
        lobbyUsers,
        peersInLobby,
        workspaceViewers,
        ownerId: effectiveOwnerId,
        isOwner,
        readOnly: !isOwner,
        navigateToWorkspace
    };
};

export default useCanvasWorkspace;
