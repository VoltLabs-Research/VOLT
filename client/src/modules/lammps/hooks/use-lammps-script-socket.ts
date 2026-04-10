import useCollaborativeDocumentSocket from '@/modules/socket/core/hooks/use-collaborative-document-socket';
import { useCallback } from 'react';
import type { PresenceUser } from '@/modules/socket/trajectory/api/entities/presence-user';

interface LammpsContentUpdatedPayload {
    scriptId: string;
    fileId: string;
    content: string;
    timestamp: number;
    senderId?: string;
}

interface UseLammpsScriptSocketProps {
    scriptId?: string;
    teamId?: string;
    enabled?: boolean;
    onRemoteContentUpdate?: (content: string, timestamp: number, fileId: string) => void;
}

interface UseLammpsScriptSocketResult {
    collaborators: PresenceUser[];
    sendContentUpdate: (content: string, fileId: string) => void;
}

const isLammpsContentUpdatedPayload = (value: unknown, scriptId?: string): value is LammpsContentUpdatedPayload => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const payload = value as Partial<LammpsContentUpdatedPayload>;
    return typeof payload.scriptId === 'string'
        && typeof payload.fileId === 'string'
        && typeof payload.content === 'string'
        && typeof payload.timestamp === 'number'
        && (!scriptId || payload.scriptId === scriptId);
};

const useLammpsScriptSocket = ({
    scriptId,
    teamId,
    enabled = true,
    onRemoteContentUpdate
}: UseLammpsScriptSocketProps): UseLammpsScriptSocketResult => {
    const { collaborators, sendContentUpdate: scheduleContentUpdate } = useCollaborativeDocumentSocket<
        { teamId: string; scriptId: string },
        { scriptId: string },
        LammpsContentUpdatedPayload,
        {
            eventName: 'lammps_update_content';
            teamId: string;
            scriptId: string;
            fileId: string;
            content: string;
            timestamp: number;
        }
    >({
        enabled: enabled && Boolean(scriptId) && Boolean(teamId),
        openEvent: 'lammps_open_script',
        closeEvent: 'lammps_close_script',
        contentUpdatedEvent: 'lammps_content_updated',
        presenceUpdatedEvent: 'lammps_users_update',
        buildOpenPayload: () => {
            if (!scriptId || !teamId) {
                return null;
            }

            return {
                scriptId,
                teamId
            };
        },
        buildClosePayload: () => {
            if (!scriptId) {
                return null;
            }

            return { scriptId };
        },
        matchesContentPayload: (payload): payload is LammpsContentUpdatedPayload => isLammpsContentUpdatedPayload(payload, scriptId),
        onRemoteContentUpdate: (payload) => {
            onRemoteContentUpdate?.(payload.content, payload.timestamp, payload.fileId);
        }
    });

    const sendContentUpdate = useCallback((content: string, fileId: string): void => {
        if (!scriptId || !teamId) {
            return;
        }

        scheduleContentUpdate({
            eventName: 'lammps_update_content',
            teamId,
            scriptId,
            fileId,
            content,
            timestamp: Date.now()
        });
    }, [scheduleContentUpdate, scriptId, teamId]);

    return {
        collaborators,
        sendContentUpdate
    };
};

export default useLammpsScriptSocket;
