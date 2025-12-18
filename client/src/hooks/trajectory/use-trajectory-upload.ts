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
    // We don't need updateUploadProgress from store because we update state directly via setState in handleProgress
    // or we could add an action to the store if we wanted to be purist.
    // For now, direct setState is fine as we are inside a hook/component context (mostly).
    // Actually, setState on the store instance update global state.
    const { createTrajectory: createTrajectoryInStore } = useTrajectoryStore.getState();


    const uploadAndProcessTrajectory = async (
        filesWithPaths: FileWithPath[],
        originalFolderName: string,
        teamId: string
    ) => {
        const formData = new FormData();
        filesWithPaths.forEach(({ file, path }) => {
            formData.append('trajectoryFiles', file, path);
        });

        const uploadId = uuidv4();

        formData.append('originalFolderName', originalFolderName);
        formData.append('teamId', teamId);
        formData.append('uploadId', uploadId);

        // Optimistic UI update handled by store's createTrajectory?
        // No, createTrajectory is async. We want immediate feedback.
        // But we can call the store action if we want.
        // Actually, createTrajectory in store sets the initial state synchronously before the async work?
        // Let's check the store. "set(state => ({ activeUploads ... }))" happens before "try".
        // So we DONT need it here if we call createTrajectory immediately.

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
            // We pass the callback, but the store handles the state update internally too.
            // The store calls the callback AND updates state.
            // So we don't need to update state here.
            await createTrajectoryInStore(formData, teamId, undefined, uploadId);

        } finally {
            if (unsubscribe) {
                unsubscribe();
            }
            // Remove from active uploads on success/fail is handled in store usually, 
            // but here we manually added optimistic update. 
            // The store's createTrajectory also does state updates. 
            // We duplicated logic a bit. 
            // Store's createTrajectory generates its OWN uploadId currently!
            // We need to sync them.
        }
    };

    return { uploadAndProcessTrajectory }
};

export default useTrajectoryUpload;
