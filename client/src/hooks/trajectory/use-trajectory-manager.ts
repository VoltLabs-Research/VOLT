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

import { useCallback } from 'react';
import type { TrajectoryData } from '@/types/canvas';
import useTrajectoryStore from '@/stores/trajectories';

const useTrajectoryManager = () => {
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const isLoading = useTrajectoryStore((state) => state.isLoading);
    const getTrajectoryById = useTrajectoryStore((state) => state.getTrajectoryById);

    const loadTrajectory = useCallback(async (id: string): Promise<TrajectoryData | null> => {
        try{
            await getTrajectoryById(id);
            return useTrajectoryStore.getState().trajectory;
        }catch(error){
            console.error('Error loading trajectory:', error);
            return null;
        }
    }, [getTrajectoryById]);

    const refreshTrajectory = useCallback(async (id: string) => {
        return loadTrajectory(id);
    }, [loadTrajectory]);

    return {
        trajectory,
        isLoading,
        loadTrajectory,
        refreshTrajectory
    };
};

export default useTrajectoryManager;