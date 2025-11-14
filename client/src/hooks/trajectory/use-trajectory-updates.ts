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

import { useEffect } from 'react';
import { socketService } from '@/services/socketio';
import useTrajectoryStore from '@/stores/trajectories';
import useLogger from '@/hooks/core/use-logger';

const useTrajectoryUpdates = () => {
    const logger = useLogger('use-trajectory-updates');         

    useEffect(() => {
        const unsubscribe = socketService.on('trajectory_status_updated', (data: any) => {
            const { trajectoryId, status, updatedAt } = data;

            logger.log('Received trajectory status update:', { trajectoryId, status, updatedAt, hasUpdatedAt: !!updatedAt });

            // Update the trajectory in the store
            useTrajectoryStore.setState((state) => {
                const updateData: any = { status };
                if (updatedAt) {
                    updateData.updatedAt = updatedAt;
                    logger.log('Adding updatedAt to state:', updatedAt);
                } else {
                    logger.warn('No updatedAt received from server!');
                }

                const updatedTrajectories = state.trajectories.map((traj) =>            
                    traj._id === trajectoryId ? { ...traj, ...updateData } : traj
                );

                logger.log('Updated trajectory in store:', updatedTrajectories.find(t => t._id === trajectoryId));

                return {
                    trajectories: updatedTrajectories,
                    trajectory: state.trajectory?._id === trajectoryId 
                        ? { ...state.trajectory, ...updateData } as any
                        : state.trajectory
                };
            });
        });

        return () => {
            unsubscribe();
        };
    }, [logger]);
};

export default useTrajectoryUpdates;
