export interface User{
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'user' | 'admin';
    createdAt: string;
    updatedAt: string;
}

export interface BoxBounds{
    xlo: number;
    xhi: number;
    ylo: number;
    yhi: number;
    zlo: number;
    zhi: number;
}

export interface TimestepInfo{
    timestep: number;
    natoms: number;
    gltfPath: string;
    boxBounds: BoxBounds;
}

export interface TrajectoryStats{
    totalFiles: number;
    totalSize: number;
}

export interface Trajectory{
    _id: string;
    name: string;
    folderId: string;
    owner: User | string;
    sharedWith: (User | string)[];
    frames: TimestepInfo[];
    stats: TrajectoryStats;
    createdAt: string;
    updatedAt: string;
    users: (User | string)[];
}

export interface Notification{
    _id: string;
    recipient: User | string;
    title: string;
    content: string;
    read: boolean;
    link?: string;
    createdAt: string;
    updatedAt: string;
}

export interface AnalysisConfig {
    crystal_structure: 'FCC' | 'BCC' | 'HCP';
    identification_mode: 'PTM' | 'CNA';
    max_trial_circuit_size: number;
    circuit_stretchability: number;
    defect_mesh_smoothing_level: number;
    line_smoothing_level: number;
    line_point_interval: number;
    only_perfect_dislocations: boolean;
    mark_core_atoms: boolean;
}