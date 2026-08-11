import { getListingRelevantExposures } from '@/modules/plugin/utils/listing/listing-exposures';
import { isTrajectoryNavigable } from '@/modules/trajectory/utils/trajectory-status';
import { format, isValid } from 'date-fns';
import type { GlobalSearchSectionKey } from '@/modules/dashboard/api/service';
import type { GlobalSearchResponse } from '@volt/contracts/modules/dashboard/domain';

export interface DashboardGlobalSearchItem {
    id: string;
    title: string;
    subtitle: string;
    path: string;
    teamId?: string;
    disabled?: boolean;
}

interface DashboardGlobalSearchSection {
    key: GlobalSearchSectionKey;
    items: DashboardGlobalSearchItem[];
}

const formatSearchDate = (value: string): string => {
    const date = new Date(value);

    if (!isValid(date)) {
        return '';
    }

    return format(date, 'P');
};

export const buildGlobalSearchSections = (results: GlobalSearchResponse): DashboardGlobalSearchSection[] => {
    return [
        {
            key: 'analyses',
            items: results.analyses.map((analysis) => ({
                id: analysis._id,
                title: analysis.pluginDisplayName,
                subtitle: formatSearchDate(analysis.createdAt),
                path: `/canvas/${analysis.trajectory._id}?analysis=${analysis._id}`
            }))
        },
        {
            key: 'trajectories',
            items: results.trajectories.map((trajectory) => ({
                id: trajectory._id,
                title: trajectory.name,
                subtitle: trajectory.status || '',
                path: `/canvas/${trajectory._id}`,
                disabled: !isTrajectoryNavigable(trajectory.status)
            }))
        },
        {
            key: 'containers',
            items: results.containers.map((container) => ({
                id: container._id,
                title: container.name,
                subtitle: container.image,
                path: `/dashboard/containers/${container._id}`
            }))
        },
        {
            key: 'plugins',
            items: results.plugins.map((plugin) => {
                const listingExposure = plugin.listingExposures?.exposures[0] ?? getListingRelevantExposures(plugin.exposures)[0];

                return {
                    id: plugin._id,
                    title: plugin.modifier?.name || plugin._id,
                    subtitle: plugin.modifier?.description || '',
                    path: listingExposure
                        ? `/dashboard/plugins/${plugin._id}/exposure/${listingExposure.exposureId}/listing`
                        : '/dashboard/plugins/list'
                };
            })
        },
        {
            key: 'teams',
            items: results.teams.map((team) => ({
                id: team._id,
                title: team.name,
                subtitle: team.description || '',
                path: '/dashboard/my-team',
                teamId: team._id
            }))
        },
        {
            key: 'chats',
            items: results.chats.map((chat) => ({
                id: chat._id,
                title: chat.participants
                    .map((participant) => participant.firstName || participant.email)
                    .join(', ') || 'Chat',
                subtitle: chat.lastMessage?.content?.substring(0, 50) || 'No messages',
                path: `/dashboard/messages/${chat._id}`
            }))
        }
    ];
};
