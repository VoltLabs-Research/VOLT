import { LANDING_CLUSTER, LANDING_TEAM, LANDING_TEAM_ID, LANDING_USER, hoursAgo } from '@/modules/marketing/utils/landing-workspace';

export const SHEAR_DEFORMATION_ID = 'landing-shear-deformation';

export const SAMPLE_ATOMS = 36_624;
const SIZE = 3_506_104;

// The simulation cell of each dump in the server's bundled Shear Deformation sample, as the
// server stores them: the box shears as the run goes on.
const CELLS = [
    {
        timestep: 75_000,
        boundingBox: { width: 90.58944151279078, length: 52.707729912900064, height: 86.41304784189408 },
        geometry: {
            cell_vectors: [[90.58944151279078, 0, 0], [-1.5634231209874856, 52.707729912900064, 0], [0.7426584524399734, 3.223034999999996, 86.41304784189408]],
            cell_origin: [-0.409470756396523, -0.2217649564501727, -43.20652392094704]
        }
    },
    {
        timestep: 1_500_000,
        boundingBox: { width: 90.55068810365181, length: 52.72915226820972, height: 86.39798147457802 },
        geometry: {
            cell_vectors: [[90.55068810365181, 0, 0], [-1.5465102388630512, 52.72915226820972, 0], [5.5935277867958035, 11.731547731790265, 86.39798147457802]],
            cell_origin: [-0.39009405182825674, -0.23247613410524792, -43.19899073728901]
        }
    },
    {
        timestep: 2_625_000,
        boundingBox: { width: 90.56452363664906, length: 52.722222905350264, height: 86.4107668476451 },
        geometry: {
            cell_vectors: [[90.56452363664906, 0, 0], [-1.5490885561129988, 52.722222905350264, 0], [15.728589424473382, 7.361779189299455, 86.4107668476451]],
            cell_origin: [-0.39701181833199684, -0.22901145267538325, -43.20538342382255]
        }
    }
];

export const SAMPLE_TIMESTEPS = CELLS.map((cell) => cell.timestep);

const UPLOADED = hoursAgo(2);

export const LANDING_SIMULATION_CELLS = CELLS.map((cell) => ({
    _id: `landing-cell-${cell.timestep}`,
    boundingBox: cell.boundingBox,
    geometry: { ...cell.geometry, periodic_boundary_conditions: { x: true, y: true, z: true } },
    team: LANDING_TEAM_ID,
    trajectory: { _id: SHEAR_DEFORMATION_ID, name: 'Shear Deformation' },
    timestep: cell.timestep,
    createdAt: UPLOADED,
    updatedAt: UPLOADED
}));

const creator = {
    _id: LANDING_USER._id,
    email: LANDING_USER.email,
    firstName: LANDING_USER.firstName,
    lastName: LANDING_USER.lastName
};

const listed = (_id: string, name: string, status: string, hours: number, frames: number, totalSize: number) => ({
    _id,
    createdAt: hoursAgo(hours),
    updatedAt: hoursAgo(hours),
    name,
    team: LANDING_TEAM_ID,
    folder: null,
    storageClusterId: { _id: LANDING_CLUSTER._id, name: LANDING_CLUSTER.name },
    createdBy: creator,
    status,
    isPublic: false,
    hasPreview: status === 'completed',
    stats: { totalFiles: frames, totalSize },
    framesCount: frames,
    atoms: SAMPLE_ATOMS,
    firstTimestep: frames > 0 ? SAMPLE_TIMESTEPS[0] : undefined
});

// The lab's dashboard: the sample every team starts with, and what it uploaded next, still
// on its way through the cluster's queue.
export const LANDING_TRAJECTORY_LIST = [
    listed(SHEAR_DEFORMATION_ID, 'Shear Deformation', 'completed', 2, CELLS.length, SIZE),
    listed('landing-nanoindentation', 'Nanoindentation', 'processing', 0.2, 0, 0),
    listed('landing-tensile-test', 'Tensile Test', 'queued', 0.1, 0, 0)
];

const folder = (_id: string, title: string, totalFiles: number, totalSize: number, hours: number) => ({
    _id,
    title,
    parent: null,
    stats: { totalFiles, totalSize },
    createdAt: hoursAgo(hours),
    updatedAt: hoursAgo(hours)
});

export const LANDING_FOLDERS = [
    folder('landing-folder-indentation', 'Indentation runs', 14, 412_000_000, 30),
    folder('landing-folder-grain-boundaries', 'Grain boundaries', 9, 268_000_000, 75)
];

// The sample as the canvas reads it.
export const SHEAR_DEFORMATION = {
    _id: SHEAR_DEFORMATION_ID,
    createdAt: UPLOADED,
    updatedAt: UPLOADED,
    name: 'Shear Deformation',
    team: { ...LANDING_TEAM, owner: LANDING_USER._id },
    folder: null,
    storageClusterId: LANDING_CLUSTER._id,
    createdBy: LANDING_USER._id,
    status: 'completed',
    isPublic: false,
    hasPreview: true,
    stats: { totalFiles: CELLS.length, totalSize: SIZE },
    frames: LANDING_SIMULATION_CELLS.map((cell) => ({ timestep: cell.timestep, natoms: SAMPLE_ATOMS, simulationCell: cell }))
};

export const shearDeformationBootstrap = (analysisIds: string[]) => ({
    access: { mode: 'read-only', isGuest: false, isPublic: false, hasTeamMembership: true },
    trajectory: {
        _id: SHEAR_DEFORMATION_ID,
        name: SHEAR_DEFORMATION.name,
        status: 'completed',
        isPublic: false,
        teamId: LANDING_TEAM_ID,
        analysisIds,
        frames: LANDING_SIMULATION_CELLS.map((cell) => ({ timestep: cell.timestep, natoms: SAMPLE_ATOMS, simulationCell: cell._id }))
    }
});
