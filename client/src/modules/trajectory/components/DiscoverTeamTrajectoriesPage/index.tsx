import SimulationGrid from '@/modules/trajectory/components/SimulationGrid';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { SearchInput } from '@voltstack/bravais';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import usePaginationParams from '@/shared/ui/hooks/use-pagination-params';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ChangeEvent } from 'react';
import type { PublicSimulationGridSummary } from '@/modules/trajectory/components/SimulationGrid';
import './DiscoverTeamTrajectoriesPage.css';

const DEFAULT_DISCOVERY_SUMMARY: PublicSimulationGridSummary = {
    team: null,
    total: 0
};

export default function DiscoverTeamTrajectoriesPage() {
    const { teamId } = useParams<{ teamId: string }>();
    const { search, setSearch } = usePaginationParams();
    const [summary, setSummary] = useState<PublicSimulationGridSummary>(DEFAULT_DISCOVERY_SUMMARY);
    const pageTitle = summary.team?.name
        ? `${summary.team.name} public trajectories`
        : 'Public trajectories';

    usePageTitle(pageTitle);

    useEffect(() => {
        setSummary(DEFAULT_DISCOVERY_SUMMARY);
    }, [teamId]);

    const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setSearch(event.target.value);
    }, [setSearch]);

    if (!teamId) {
        return (
            <main className='discover-team-trajectories-page'>
                <div className='discover-team-trajectories-page__inner items-center justify-center'>
                    <RecoveryState
                        title='Team not found'
                        description='The discovery link is missing a team identifier.'
                        tone={RecoveryStateTone.Error}
                    />
                </div>
            </main>
        );
    }

    return (
        <main className='discover-team-trajectories-page'>
            <div className='discover-team-trajectories-page__inner'>
                <section className='discover-team-trajectories-page__header' aria-labelledby='discover-team-trajectories-title'>
                    <div className='discover-team-trajectories-page__title-block'>
                        <h1 className='text-3xl font-medium text-foreground discover-team-trajectories-page__title'
                            id='discover-team-trajectories-title'
                        >
                            Trajectories ({summary.total})
                        </h1>
                        <p className='text-xs text-muted discover-team-trajectories-page__description'
                        >
                            {`Public trajectories from ${summary.team?.name ?? 'this team'}.`}
                        </p>
                    </div>
                    <SearchInput
                        value={search}
                        onChange={handleSearchChange}
                        placeholder='Search trajectories'
                        aria-label='Search public trajectories'
                        containerClassName='discover-team-trajectories-page__search'
                    />
                </section>
                <section className='discover-team-trajectories-page__grid' aria-label='Public trajectories'>
                    <SimulationGrid
                        mode='public'
                        teamId={teamId}
                        onPublicListingChange={setSummary}
                    />
                </section>
            </div>
        </main>
    );
}
