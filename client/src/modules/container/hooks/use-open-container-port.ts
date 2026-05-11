import service from '@/modules/container/api/service';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { sileo } from 'sileo';
import { useCallback, useState } from 'react';

export const useOpenContainerPort = () => {
    const teamId = useSelectedTeamId();
    const [openingPort, setOpeningPort] = useState<number | null>(null);

    const openPort = useCallback(async (containerId: string, privatePort: number) => {
        if (!teamId) {
            sileo.error({ title: 'No team selected' });
            return;
        }

        setOpeningPort(privatePort);

        try {
            const accessUrl = await service.createPortAccessUrl({
                teamId,
                containerId,
                privatePort
            });

            window.open(accessUrl.url, '_blank', 'noopener,noreferrer');
        } catch {
            sileo.error({ title: 'Failed to open container app' });
        } finally {
            setOpeningPort(null);
        }
    }, [teamId]);

    return {
        openPort,
        openingPort
    };
};
