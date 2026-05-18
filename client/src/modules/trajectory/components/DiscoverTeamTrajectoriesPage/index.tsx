import SimulationGrid from '@/modules/trajectory/components/SimulationGrid';
import DiscoverTeamEmailPrompt from '@/modules/early-access/components/DiscoverTeamEmailPrompt';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Heading from '@/shared/presentation/primitives/Heading';
import SearchInput from '@/shared/presentation/primitives/SearchInput';
import Text from '@/shared/presentation/primitives/Text';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import usePaginationParams from '@/shared/presentation/hooks/use-pagination-params';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
    const teamName = summary.team?.name ?? 'this team';
    const pageTitle = summary.team?.name
        ? `${summary.team.name} public trajectories`
        : 'Public trajectories';
    const description = useMemo(() => (
        `Public trajectories from ${teamName}.`
    ), [teamName]);

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
                <div className='discover-team-trajectories-page__inner flex-center'>
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
                        <Heading
                            id='discover-team-trajectories-title'
                            level={1}
                            size='3xl'
                            weight='medium'
                            className='discover-team-trajectories-page__title'
                        >
                            Trajectories ({summary.total})
                        </Heading>
                        <Text
                            as='p'
                            size='sm'
                            tone='muted'
                            className='discover-team-trajectories-page__description'
                        >
                            {description}
                        </Text>
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
            <DiscoverTeamEmailPrompt teamId={teamId} teamName={teamName} />
        </main>
    );
}
