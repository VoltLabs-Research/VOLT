import sceneArtifactService from '@/modules/trajectory/api/services/scene-artifacts';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';
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

const renderTrajectory: NonNullable<ColumnConfig<SceneArtifact>['render']> = (_value, artifact) => {
    if (typeof artifact.trajectory === 'string') {
        return artifact.trajectory;
    }

    return artifact.trajectory.name || artifact.trajectory._id;
};

const renderCluster: NonNullable<ColumnConfig<SceneArtifact>['render']> = (_value, artifact) => {
    const teamCluster = artifact.teamCluster
        || (typeof artifact.trajectory === 'string' ? null : artifact.trajectory.teamCluster);

    if (!teamCluster) {
        return <span className='font-size-2 color-muted'>-</span>;
    }

    if (typeof teamCluster === 'string') {
        return <span className='font-size-2 color-secondary'>{teamCluster}</span>;
    }

    return <span className='font-size-2 color-secondary'>{teamCluster.name || teamCluster._id}</span>;
};

const renderPlugin: NonNullable<ColumnConfig<SceneArtifact>['render']> = (_value, artifact) => {
    if (!artifact.plugin) {
        return <span className='font-size-2 color-muted'>-</span>;
    }

    if (typeof artifact.plugin === 'string') {
        return <span className='font-size-2 color-secondary'>{artifact.plugin}</span>;
    }

    return <span className='font-size-2 color-secondary'>{artifact.plugin.name || artifact.plugin._id}</span>;
};

const renderAnalysisId: NonNullable<ColumnConfig<SceneArtifact>['render']> = (_value, artifact) => {
    if (!artifact.analysis) {
        return <span className='font-size-2 color-muted'>-</span>;
    }

    if (typeof artifact.analysis === 'string') {
        return artifact.analysis;
    }

    return artifact.analysis._id;
};

const COLUMNS: ColumnConfig<SceneArtifact>[] = [
    {
        key: 'trajectory',
        title: 'Trajectory',
        sortable: false,
        render: renderTrajectory,
        skeleton: { variant: 'text', width: 180 }
    },
    {
        key: 'timestep',
        title: 'Timestep',
        sortable: true,
        render: (value) => <span className='font-size-2 color-secondary'>{String(value)}</span>,
        skeleton: { variant: 'text', width: 80 }
    },
    {
        key: 'status',
        title: 'Status',
        sortable: true,
        render: (value) => <span className='font-size-2 color-secondary'>{String(value)}</span>,
        skeleton: { variant: 'text', width: 90 }
    },
    {
        key: 'displayName',
        title: 'Display Name',
        sortable: true,
        render: (value) => <span className='font-size-2 color-secondary'>{String(value)}</span>,
        skeleton: { variant: 'text', width: 180 }
    },
    {
        key: 'teamCluster',
        title: 'Cluster',
        sortable: false,
        render: renderCluster,
        skeleton: { variant: 'text', width: 140 }
    },
    {
        key: 'plugin',
        title: 'Plugin',
        sortable: false,
        render: renderPlugin,
        skeleton: { variant: 'text', width: 140 }
    },
    {
        key: 'analysis',
        title: 'Analysis ID',
        sortable: false,
        render: renderAnalysisId,
        skeleton: { variant: 'text', width: 160 }
    },
    {
        key: 'sourceType',
        title: 'Source',
        sortable: true,
        render: (value) => <span className='font-size-2 color-secondary'>{String(value)}</span>,
        skeleton: { variant: 'text', width: 120 }
    },
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
