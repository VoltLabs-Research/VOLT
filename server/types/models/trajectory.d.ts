// Defines the limits of the simulation box on the three axes.
export interface IBoxBounds{
    xlo: number;
    xhi: number;
    ylo: number;
    yhi: number;
    zlo: number;
    zhi: number;
}

export interface ITimestepInfo{
    timestep: number;
    natoms: number;
    boxBounds: IBoxBounds
    gltfPath: string;
}

export interface ITrajectory extends Document {
    name: string;
    folderId: string;
    owner: mongoose.Types.ObjectId;
    sharedWith: mongoose.Types.ObjectId[];
    frames: ITimestepInfo[],
    stats: {
        totalFiles: number;
        totalSize: number;
    };
}