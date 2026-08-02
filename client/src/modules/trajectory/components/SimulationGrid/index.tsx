import DashboardSimulationGrid from './DashboardSimulationGrid';
import PublicSimulationGrid from './PublicSimulationGrid';
import './SimulationGrid.css';
import type { PublicSimulationGridSummary } from './PublicSimulationGrid';

export type { PublicSimulationGridSummary };

interface SimulationGridProps {
    mode?: 'dashboard' | 'public';
    teamId?: string;
    onPublicListingChange?: (summary: PublicSimulationGridSummary) => void;
}

const SimulationGrid = ({ mode = 'dashboard', teamId, onPublicListingChange }: SimulationGridProps) => {
    if (mode === 'public') {
        return (
            <PublicSimulationGrid
                teamId={teamId}
                onPublicListingChange={onPublicListingChange}
            />
        );
    }

    return <DashboardSimulationGrid />;
};

export default SimulationGrid;
