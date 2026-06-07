import sceneArtifactService from '@/modules/trajectory/api/services/scene-artifacts-service';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import { Text } from '@voltstack/bravais';
import { dateColumn, enumColumn, populatedNameColumn, statusColumn } from '@/shared/presentation/utilities/column-presets';
import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifacts/scene-artifact';
import { createEmptyPaginatedResponse } from '@/shared/domain/pagination/create-empty-paginated-response';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { useCallback, useMemo } from 'react';

const COLUMNS: ColumnConfig<SceneArtifact>[] = [
    {
        key: 'displayName',
        title: 'Display Name',
        sortable: true,
        render: (value) => <Text size='md' tone='secondary'>{String(value)}</Text>,
        skeleton: { variant: 'text', width: 180 }
    },
    enumColumn<SceneArtifact>('sourceType', 'Source', { sortable: true, width: 120 }),
    populatedNameColumn<SceneArtifact>('trajectory', 'Trajectory', { width: 180 }),
    {
        key: 'timestep',
        title: 'Timestep',
        sortable: true,
        render: (value) => <Text size='md' tone='secondary'>{String(value)}</Text>,
        skeleton: { variant: 'text', width: 80 }
    },
    statusColumn<SceneArtifact>('status', 'Status', { sortable: true, width: 90 }),
    dateColumn<SceneArtifact>('updatedAt', 'Updated At', {
        width: 110,
        withTitle: true
    })
];

const TrajectoryArtifactsListing = () => {
    const teamId = useSelectedTeamId();
    const queryKey = useMemo(() => ['trajectory', 'team-scene-artifacts', teamId] as const, [teamId]);

    const fetchArtifacts = useCallback(async (params: PaginationParams): Promise<PaginatedResponse<SceneArtifact>> => {
        if (!teamId) {
            return createEmptyPaginatedResponse(params);
        }

        return sceneArtifactService.listByTeam({
            page: params.page,
            limit: params.limit
        });
    }, [teamId]);

    return (
        <DocumentListing<SceneArtifact>
            title='Trajectory Artifacts'
            queryKey={queryKey}
            columns={COLUMNS}
            fetchData={fetchArtifacts}
            defaultLimit={20}
            emptyMessage='No trajectory artifacts found for this team.'
        />
    );
};

export default TrajectoryArtifactsListing;
