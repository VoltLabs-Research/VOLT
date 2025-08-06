import { useEffect, useCallback } from 'react';
import useTrajectoryUpload from '@/hooks/trajectory/use-trajectory-upload';
import useTeamStore from '@/stores/team';
import useConfigurationStore from '@/stores/editor/configuration';
import type { FileWithPath } from '@/hooks/trajectory/use-trajectory-upload';
import useLogger from '@/hooks/useLogger';

const useFileUpload = (
    onUploadSuccess?: () => void
) => {
    const { uploadAndProcessTrajectory } = useTrajectoryUpload();
    const { analysisConfig } = useConfigurationStore((state) => state.analysisConfig);
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const logger = useLogger('use-file-upload');

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
            logger.error(error.message);
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
            logger.error('Upload failed:', error);
        }
    }, [uploadAndProcessTrajectory, analysisConfig, selectedTeam]);

    return {
        uploadFiles
    }
};

export default useFileUpload;