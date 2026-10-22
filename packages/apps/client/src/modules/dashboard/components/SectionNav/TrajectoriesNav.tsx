import SectionNav from '@/modules/dashboard/components/SectionNav';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import {
    SIMULATION_CELLS_PATH,
    TRAJECTORIES_LIST_PATH,
    TRAJECTORY_ARTIFACTS_PATH,
    isTrajectoryAtomsPath
} from '@/modules/dashboard/utils/sidebar-panels';
import { Box, Cuboid, Package, Table } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import type { SectionNavLink } from '@/modules/dashboard/components/SectionNav';

interface TrajectoriesNavProps {
    active: boolean;
    collapsed: boolean;
}

const TrajectoriesNav = ({ active, collapsed }: TrajectoriesNavProps) => {
    const { pathname, search } = useLocation();
    const { canAccess } = useTeamPermissions();
    const trajectoriesDenied = canAccess(['trajectory:read']) ? undefined : 'You do not have permission to view trajectories.';
    const cellsDenied = canAccess(['simulation-cell:read']) ? undefined : 'You do not have permission to view simulation cells.';

    const links: SectionNavLink[] = [
        {
            label: 'Trajectories',
            icon: Box,
            to: TRAJECTORIES_LIST_PATH,
            isActive: pathname === TRAJECTORIES_LIST_PATH,
            disabledReason: trajectoriesDenied
        },
        {
            label: 'Artifacts',
            icon: Package,
            to: TRAJECTORY_ARTIFACTS_PATH,
            isActive: pathname === TRAJECTORY_ARTIFACTS_PATH,
            disabledReason: trajectoriesDenied
        },
        {
            label: 'Simulation cells',
            icon: Cuboid,
            to: SIMULATION_CELLS_PATH,
            isActive: pathname === SIMULATION_CELLS_PATH,
            disabledReason: cellsDenied
        }
    ];

    // Per-atom properties belong to one trajectory and frame, which only the open page knows,
    // so the row is there while one is open.
    if (isTrajectoryAtomsPath(pathname)) {
        links.push({
            label: 'Per-atom properties',
            icon: Table,
            to: `${pathname}${search}`,
            isActive: true
        });
    }

    return (
        <SectionNav
            name='trajectories'
            title='Trajectories'
            backTo='/dashboard'
            links={links}
            active={active}
            collapsed={collapsed}
        />
    );
};

export default TrajectoriesNav;
