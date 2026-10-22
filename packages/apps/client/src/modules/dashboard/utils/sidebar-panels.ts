import { matchPath } from 'react-router-dom';
import type { SidebarPanelName } from '@/shared/ui/components/SidebarPanel';

export const TRAJECTORIES_LIST_PATH = '/dashboard/trajectories/list';
export const TRAJECTORY_ARTIFACTS_PATH = '/dashboard/trajectories/artifacts';
export const SIMULATION_CELLS_PATH = '/dashboard/simulation-cells/list';
const TRAJECTORY_ATOMS_ROUTE = '/dashboard/trajectory/:trajectoryId/atoms';
export const SECRET_KEYS_PATH = '/dashboard/settings/secret-keys';
export const SECRET_KEY_METRICS_PATH = `${SECRET_KEYS_PATH}/metrics`;

export const isTrajectoryAtomsPath = (pathname: string): boolean => matchPath(TRAJECTORY_ATOMS_ROUTE, pathname) !== null;

const isTrajectoriesSectionPath = (pathname: string): boolean => (
    pathname.startsWith('/dashboard/trajectories/')
    || pathname.startsWith('/dashboard/simulation-cells/')
    || isTrajectoryAtomsPath(pathname)
);

// The sidebar shows one panel at a time; a section with pages of its own replaces the main one.
export const sidebarPanelFor = (pathname: string): SidebarPanelName => {
    if (pathname.startsWith(SECRET_KEYS_PATH)) return 'secret-keys';
    if (pathname.startsWith('/dashboard/settings')) return 'settings';
    if (pathname.startsWith('/dashboard/ai')) return 'ai';
    if (isTrajectoriesSectionPath(pathname)) return 'trajectories';

    return 'app';
};
