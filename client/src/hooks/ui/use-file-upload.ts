import { useEffect, useCallback } from 'react';
import useTrajectoryUpload from '@/hooks/trajectory/use-trajectory-upload';
import useEditorStore from '@/stores/editor';
import useTeamStore from '@/stores/team';
import type { FileWithPath } from '@/hooks/trajectory/use-trajectory-upload';

const useFileUpload = (
    onUploadSuccess?: () => void
) => {
    const { uploadAndProcessTrajectory } = useTrajectoryUpload();
    const { analysisConfig } = useEditorStore((state) => state.analysisConfig);
    const selectedTeam = useTeamStore((state) => state.selectedTeam);

    useEffect(() => {
        if(onUploadSuccess){
            onUploadSuccess();
        }
    }, [onUploadSuccess]);

    const uploadFiles = useCallback(async (
        filesWithPath: FileWithPath[],
        folderName: string
    ) => {
        if(!selectedTeam?._id){
            const error = new Error('No team selected');
            console.error(error.message);
            return;
        }

        try{
            await uploadAndProcessTrajectory(
                filesWithPath,
                folderName,
                analysisConfig,
                selectedTeam._id
            );
        }catch(err){
            const error = err instanceof Error ? err : new Error('Upload failed');
            console.error('Upload failed:', error);
        }
    }, [uploadAndProcessTrajectory, analysisConfig, selectedTeam]);

    return {
        uploadFiles
    }
};

export default useFileUpload;