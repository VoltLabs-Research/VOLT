import useSocket from './use-socket';
import { socketErrorReporter } from '../services/socket-error-reporter';
import { useEffect, useRef } from 'react';

interface UseSocketRoomOptions<TJoinPayload, TLeavePayload = TJoinPayload> {
    joinEvent: string;
    leaveEvent?: string;
    roomKey: string | null | undefined;
    buildJoinPayload: () => TJoinPayload | null;
    buildLeavePayload?: () => TLeavePayload | null;
    enabled?: boolean;
    fireAndForget?: boolean;
};

const useSocketRoom = <TJoinPayload, TLeavePayload = TJoinPayload>(
    options: UseSocketRoomOptions<TJoinPayload, TLeavePayload>
): void => {
    const {
        joinEvent,
        leaveEvent,
        roomKey,
        buildJoinPayload,
        buildLeavePayload,
        enabled = true,
        fireAndForget = true
    } = options;

    const socketService = useSocket();
    const buildJoinPayloadRef = useRef(buildJoinPayload);
    const buildLeavePayloadRef = useRef(buildLeavePayload);

    buildJoinPayloadRef.current = buildJoinPayload;
    buildLeavePayloadRef.current = buildLeavePayload;

    useEffect(() => {
        if (!enabled || !roomKey) {
            return;
        }

        let cancelled = false;
        let isJoined = false;

        const performJoin = (): void => {
            if (cancelled || isJoined) return;
            const payload = buildJoinPayloadRef.current();
            if (payload === null || payload === undefined) return;

            isJoined = true;

            if (fireAndForget) {
                try {
                    socketService.emitWithoutAck(joinEvent, payload);
                } catch (error) {
                    isJoined = false;
                    socketErrorReporter.report(error, { kind: 'subscribe', event: joinEvent, roomKey });
                }
                return;
            }

            socketService.emit(joinEvent, payload).catch((error) => {
                if (cancelled) return;
                isJoined = false;
                socketErrorReporter.report(error, { kind: 'subscribe', event: joinEvent, roomKey });
            });
        };

        socketService.connect().catch(() => undefined);

        if (socketService.isConnected()) {
            performJoin();
        }

        const unsubscribeConnection = socketService.onConnectionChange((connected) => {
            if (!connected) {
                isJoined = false;
                return;
            }

            performJoin();
        });

        return () => {
            cancelled = true;
            unsubscribeConnection();

            if (!isJoined || !leaveEvent) return;
            if (!socketService.isConnected()) return;

            const leavePayloadBuilder = buildLeavePayloadRef.current ?? buildJoinPayloadRef.current;
            const leavePayload = leavePayloadBuilder() as TLeavePayload | TJoinPayload | null;
            if (leavePayload === null || leavePayload === undefined) return;

            if (fireAndForget) {
                try {
                    socketService.emitWithoutAck(leaveEvent, leavePayload);
                } catch {
                }
                return;
            }

            socketService.emit(leaveEvent, leavePayload).catch(() => undefined);
        };
    }, [socketService, joinEvent, leaveEvent, roomKey, enabled, fireAndForget]);
};

export default useSocketRoom;
