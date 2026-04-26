import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import useThrottledSocketEmit from '@/modules/socket/hooks/use-throttled-socket-emit';
import { SOCKET_CANVAS_WORKSPACE_EVENTS } from '@/modules/socket/events/canvas';
import { useEffect } from 'react';
import { localModelDragBus, remoteModelDragBus } from './live-drag-bus';

interface UseLiveModelDragOptions {
    trajectoryId?: string;
    ownerId?: string;
    isOwner: boolean;
    enabled?: boolean;
}

interface LiveDragPayload {
    trajectoryId: string;
    ownerId: string;
    sceneKey: string;
    x: number;
    y: number;
    z: number;
}

const EMIT_THROTTLE_MS = 40;

const useLiveModelDrag = ({
    trajectoryId,
    ownerId,
    isOwner,
    enabled = true
}: UseLiveModelDragOptions) => {
    const dragEmitter = useThrottledSocketEmit<LiveDragPayload>(SOCKET_CANVAS_WORKSPACE_EVENTS.MODEL_DRAG, {
        intervalMs: EMIT_THROTTLE_MS,
        mode: 'leading-throttle',
        enabled: enabled && !!trajectoryId && !!ownerId && isOwner,
        fireAndForget: true
    });

    useEffect(() => {
        if (!enabled || !trajectoryId || !ownerId || !isOwner) {
            return;
        }

        return localModelDragBus.on(({ sceneKey, offset }) => {
            dragEmitter.emit({
                trajectoryId,
                ownerId,
                sceneKey,
                x: offset.x,
                y: offset.y,
                z: offset.z
            });
        });
    }, [enabled, trajectoryId, ownerId, isOwner, dragEmitter]);

    useSocketEvent<LiveDragPayload>(SOCKET_CANVAS_WORKSPACE_EVENTS.MODEL_DRAG, (payload) => {
        if (!payload) return;
        if (payload.trajectoryId !== trajectoryId) return;
        if (payload.ownerId !== ownerId) return;
        if (!payload.sceneKey) return;

        remoteModelDragBus.emit({
            sceneKey: payload.sceneKey,
            offset: {
                x: payload.x,
                y: payload.y,
                z: payload.z
            }
        });
    }, { enabled: enabled && !!trajectoryId && !!ownerId });
};

export default useLiveModelDrag;
