import useTrajectoryStore from '../stores/trajectories';

export interface FileWithPath{
    file: File;
    path: string;
}

const useTrajectoryUpload = () => {
    const { createTrajectory, isUploading } = useTrajectoryStore();

    const uploadAndProcessTrajectory = async (
        filesWithPaths: FileWithPath[], 
        originalFolderName: string,
        analysisConfig: any
    ) => {
        const formData = new FormData();
        filesWithPaths.forEach(({ file, path }) => {
            formData.append('trajectoryFiles', file, path);
        });

        formData.append('originalFolderName', originalFolderName);
        formData.append('analysisConfig', JSON.stringify(analysisConfig));

        await createTrajectory(formData);
    };

    return {
        uploadAndProcessTrajectory,
        isUploading
    }
};

export default useTrajectoryUpload;