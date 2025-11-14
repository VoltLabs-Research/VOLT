/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { useEffect, useCallback } from 'react';
import useTrajectoryUpload from '@/hooks/trajectory/use-trajectory-upload';
import useTeamStore from '@/stores/team/team';
import type { FileWithPath } from '@/hooks/trajectory/use-trajectory-upload';
import useLogger from '@/hooks/core/use-logger';

const useFileUpload = (
    onUploadSuccess?: () => void
) => {
    const { uploadAndProcessTrajectory } = useTrajectoryUpload();
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
                selectedTeam._id
            );
        }catch(err: any){
            logger.error('Upload failed', { error: err?.message });
            // Don't rethrow - let the trajectory be created anyway if it exists
            // Errors during processing should not affect the UI showing the card
        }
    }, [uploadAndProcessTrajectory, selectedTeam]);

    return {
        uploadFiles
    }
};

export default useFileUpload;