import SimulationGrid from '@/modules/trajectory/components/SimulationGrid';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { SearchField } from '@heroui/react';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import usePaginationParams from '@/shared/ui/hooks/use-pagination-params';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { PublicSimulationGridSummary } from '@/modules/trajectory/components/SimulationGrid';

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

    if (!teamId) {
        return (
            <main className='min-h-screen bg-background p-[2rem_1.5rem_3rem] text-foreground max-md:p-[1.25rem_1rem_2rem]'>
                <div className='mx-auto flex w-[min(100%,1180px)] min-h-[calc(100vh-5rem)] flex-col gap-6 max-md:min-h-[calc(100vh-3.25rem)] items-center justify-center'>
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
        <main className='min-h-screen bg-background p-[2rem_1.5rem_3rem] text-foreground max-md:p-[1.25rem_1rem_2rem]'>
            <div className='mx-auto flex w-[min(100%,1180px)] min-h-[calc(100vh-5rem)] flex-col gap-6 max-md:min-h-[calc(100vh-3.25rem)]'>
                <section className='flex flex-row items-end justify-between gap-4 pt-2 pb-1 max-md:flex-col max-md:items-stretch' aria-labelledby='discover-team-trajectories-title'>
                    <div className='min-w-0'>
                        <h1 className='m-0 text-3xl font-medium leading-[1.1] text-foreground'
                            id='discover-team-trajectories-title'
                        >
                            Trajectories ({summary.total})
                        </h1>
                        <p className='mt-[0.35rem] mb-0 text-xs text-muted'>
                            {`Public trajectories from ${summary.team?.name ?? 'this team'}.`}
                        </p>
                    </div>
                    <SearchField
                        value={search}
                        onChange={setSearch}
                        aria-label='Search public trajectories'
                        className='w-[min(100%,22rem)] shrink-0 max-md:w-full'
                    >
                        <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder='Search trajectories' />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>
                </section>
                <section className='flex min-h-0 flex-1 [&>*]:w-full' aria-label='Public trajectories'>
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
