export interface ITrajectory extends Document {
    name: string;
    folderId: string;
    owner: mongoose.Types.ObjectId;
    sharedWith: mongoose.Types.ObjectId[];
    stats: {
        totalFiles: number;
        totalSize: number;
    };
}