import sceneArtifactService from '@/modules/trajectory/api/services/scene-artifacts';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import PopulatedCellPopover from '@/shared/presentation/components/PopulatedCellPopover';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import { clusterColumn, dateColumn, enumColumn, populatedNameColumn, statusColumn } from '@/shared/presentation/utilities/column-presets';
import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifacts';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { useCallback, useMemo } from 'react';

const createEmptyResponse = (params: PaginationParams): PaginatedResponse<SceneArtifact> => ({
    status: 'success',
    data: [],
    pagination: {
        page: Math.max(1, Number(params.page) || 1),
        limit: Math.max(1, Number(params.limit) || 20),
        total: 0,
        totalPages: 1,
        hasMore: false
    }
});

const renderAnalysisId: NonNullable<ColumnConfig<SceneArtifact>['render']> = (_value, artifact) => {
    if (!artifact.analysis) {
        return <span className='font-size-2 color-muted'>-</span>;
    }

    const analysis = typeof artifact.analysis === 'string' ? null : artifact.analysis as unknown as Record<string, unknown>;
    const label = typeof artifact.analysis === 'string' ? artifact.analysis : artifact.analysis._id;

    return (
        <PopulatedCellPopover document={analysis} modelName='Analysis'>
            <span>{label}</span>
        </PopulatedCellPopover>
    );
};

const COLUMNS: ColumnConfig<SceneArtifact>[] = [
    populatedNameColumn<SceneArtifact>('trajectory', 'Trajectory', { width: 180 }),
    {
        key: 'timestep',
        title: 'Timestep',
        sortable: true,
        render: (value) => <span className='font-size-2 color-secondary'>{String(value)}</span>,
        skeleton: { variant: 'text', width: 80 }
    },
    statusColumn<SceneArtifact>('status', 'Status', { sortable: true, width: 90 }),
    {
        key: 'displayName',
        title: 'Display Name',
        sortable: true,
        render: (value) => <span className='font-size-2 color-secondary'>{String(value)}</span>,
        skeleton: { variant: 'text', width: 180 }
    },
    clusterColumn<SceneArtifact>(),
    populatedNameColumn<SceneArtifact>('plugin', 'Plugin'),
    {
        key: 'analysis',
        title: 'Analysis ID',
        sortable: false,
        render: renderAnalysisId,
        skeleton: { variant: 'text', width: 160 }
    },
    enumColumn<SceneArtifact>('sourceType', 'Source', { sortable: true, width: 120 }),
    dateColumn<SceneArtifact>('updatedAt', 'Updated At', {
        width: 110,
        withTitle: true
    }),
    dateColumn<SceneArtifact>('createdAt', 'Created At', {
        width: 110,
        withTitle: true
    })
];

const TrajectoryArtifactsListing = () => {
    const teamId = useSelectedTeamId();
    const queryKey = useMemo(() => ['trajectory', 'team-scene-artifacts', teamId] as const, [teamId]);

    const fetchArtifacts = useCallback(async (params: PaginationParams): Promise<PaginatedResponse<SceneArtifact>> => {
        if (!teamId) {
            return createEmptyResponse(params);
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
