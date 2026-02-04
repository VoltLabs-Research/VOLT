import { useEffect, useCallback } from 'react';
import useTrajectoryUpload from '@/features/trajectory/hooks/use-trajectory-upload';
import { useTeamStore } from '@/features/team/stores';
import type { FileWithPath } from '@/features/trajectory/hooks/use-trajectory-upload';
import useLogger from '@/hooks/core/use-logger';

const useFileUpload = (
    onUploadSuccess?: () => void
) => {
    const { uploadAndProcessTrajectory } = useTrajectoryUpload();
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const logger = useLogger('use-file-upload');

    const uploadFiles = useCallback(async(
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
                selectedTeam._id
            );
        }catch(err: any){
            logger.error('Upload failed', { error: err?.message });
            // Don't rethrow - let the trajectory be created anyway if it exists
            // Errors during processing should not affect the UI showing the card
        }finally{
            // Call success callback after upload attempt
            if(onUploadSuccess){
                onUploadSuccess();
            }
        }
    }, [uploadAndProcessTrajectory, selectedTeam, onUploadSuccess]);

    return {
        uploadFiles
    }
};

export default useFileUpload;
