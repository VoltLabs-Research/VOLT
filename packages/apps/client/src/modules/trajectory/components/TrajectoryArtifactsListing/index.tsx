import { fetchSceneArtifactsByTeam } from '@/modules/trajectory/hooks/scene-artifacts/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import { dateColumn, enumColumn, populatedNameColumn, statusColumn } from '@/shared/ui/utils/column-presets';
import type { SceneArtifact } from '@volt/contracts/modules/trajectory/domain';
import { createEmptyPaginatedResponse } from '@/shared/pagination/create-empty-paginated-response';
import type { PaginatedResponse } from '@voltstack/voltclient';
import type { ColumnConfig } from '@/shared/ui/components/DocumentListingTable';
import type { PaginationParams } from '@/shared/ui/hooks/use-pagination-params';
import { useCallback } from 'react';

const COLUMNS: ColumnConfig<SceneArtifact>[] = [
    {
        key: 'displayName',
        title: 'Display Name',
        sortable: true,
        render: (value) => <span className='font-medium text-foreground'>{String(value)}</span>,
        skeleton: {
            variant: 'text',
            width: 180
        }
    },
    enumColumn<SceneArtifact>('sourceType', 'Source', {
        sortable: true,
        width: 120
    }),
    populatedNameColumn<SceneArtifact>('trajectory', 'Trajectory', { width: 180 }),
    {
        key: 'timestep',
        title: 'Timestep',
        sortable: true,
        numeric: true,
        render: (value) => (typeof value === 'number' ? value.toLocaleString() : '-'),
        skeleton: {
            variant: 'text',
            width: 80
        }
    },
    statusColumn<SceneArtifact>('status', 'Status', {
        sortable: true,
        width: 90
    }),
    dateColumn<SceneArtifact>('updatedAt', 'Updated At', {
        width: 110,
        withTitle: true
    })
];

const TrajectoryArtifactsListing = () => {
    const teamId = useSelectedTeamId();

    const fetchArtifacts = useCallback(async (params: PaginationParams): Promise<PaginatedResponse<SceneArtifact>> => {
        if (!teamId) {
            return createEmptyPaginatedResponse(params);
        }

        return fetchSceneArtifactsByTeam({
            page: params.page,
            limit: params.limit
        });
    }, [teamId]);

    return (
        <DocumentListing<SceneArtifact>
            title='Trajectory Artifacts'
            description='Scenes that color coding, particle filters and plugin exposures saved, one per timestep.'
            queryKey={['trajectory', 'team-scene-artifacts', teamId]}
            columns={COLUMNS}
            fetchData={fetchArtifacts}
            defaultLimit={20}
            emptyMessage='No trajectory artifacts found for this team.'
        />
    );
};

export default TrajectoryArtifactsListing;
