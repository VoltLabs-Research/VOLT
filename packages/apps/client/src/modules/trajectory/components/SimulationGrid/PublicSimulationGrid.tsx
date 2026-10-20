import SimulationSkeletonCard from '../SimulationSkeletonCard';
import SimulationCard from '../SimulationCard';
import { fetchPublicTeamTrajectories } from '@/modules/trajectory/hooks/trajectory/queries';
import DocumentListing from '@/shared/ui/components/DocumentListing';
import { useCallback } from 'react';
import type { DiscoverTeamSummary } from '@/modules/trajectory/api/services/discover-service';
import type { PaginationParams } from '@/shared/ui/hooks/use-pagination-params';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

export interface PublicSimulationGridSummary {
    team: DiscoverTeamSummary | null;
    total: number;
}

interface PublicSimulationGridProps {
    teamId?: string;
    onPublicListingChange?: (summary: PublicSimulationGridSummary) => void;
}

const renderGridSkeleton = () => <SimulationSkeletonCard n={8} />;

const PublicSimulationGrid = ({ teamId, onPublicListingChange }: PublicSimulationGridProps) => {
    const fetchData = useCallback(async (params: PaginationParams) => {
        if (!teamId) {
            throw new Error('Team ID is required to load public trajectories.');
        }

        const response = await fetchPublicTeamTrajectories({
            teamId,
            page: params.page,
            limit: params.limit,
            search: params.search
        });

        onPublicListingChange?.({
            team: response._meta?.team ?? null,
            total: response.pagination.total
        });

        return response;
    }, [onPublicListingChange, teamId]);

    const renderGridItem = useCallback((trajectory: Trajectory) => (
        <SimulationCard
            trajectory={trajectory}
            isSelected={false}
            readOnly
            discoverTeamId={teamId}
        />
    ), [teamId]);

    return (
        <DocumentListing<Trajectory>
            title='Public trajectories'
            queryKey={['discover', 'team-trajectories', teamId ?? '']}
            view='grid'
            fetchData={fetchData}
            defaultLimit={20}
            renderGridItem={renderGridItem}
            renderGridSkeleton={renderGridSkeleton}
            hideHeader
            hideTabs
            includeCopyDocumentId={false}
            emptyTitle='No public trajectories'
            emptyMessage='This team has no public trajectories.'

            gridClassName='public-simulation-grid max-md:p-0'
        />
    );
};

export default PublicSimulationGrid;
