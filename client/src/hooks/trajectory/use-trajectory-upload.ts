/**
* Copyright(c) 2025, The Volterra Authors. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files(the "Software"), to deal
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
*/

import useTrajectoryStore from '@/stores/trajectories';
import { v4 as uuidv4 } from 'uuid';
import { socketService } from '@/services/socketio';

export interface FileWithPath {
    file: File;
    path: string;
}

const useTrajectoryUpload = () => {
    const { createTrajectory: createTrajectoryInStore } = useTrajectoryStore.getState();
    const uploadId = uuidv4();

    const uploadAndProcessTrajectory = async (
        filesWithPaths: FileWithPath[],
        originalFolderName: string,
        teamId: string
    ) => {
        const formData = new FormData();
        filesWithPaths.forEach(({ file, path }) => {
            formData.append('trajectoryFiles', file, path);
        });

        formData.append('originalFolderName', originalFolderName);
        formData.append('teamId', teamId);
        formData.append('uploadId', uploadId);

        const handleProgress = (data: any) => {
            if (data.uploadId === uploadId) {
                const progress = data.progress;
                if (progress >= 1) {
                    useTrajectoryStore.getState().dismissUpload(uploadId);
                } else {
                    useTrajectoryStore.getState().updateUploadProgress(uploadId, progress, 'processing');
                }
            }
        };

        // Subscribe to socket events
        const unsubscribe = socketService.on('trajectory:upload-progress', handleProgress);

        try {
            await createTrajectoryInStore(formData, teamId, undefined, uploadId);

        } finally {
            if (unsubscribe) {
                unsubscribe();
            }
        }
    };

    return { uploadAndProcessTrajectory }
};

export default useTrajectoryUpload;
