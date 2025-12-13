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

import { useEffect } from 'react';
import { socketService } from '@/services/socketio';
import useTrajectoryStore from '@/stores/trajectories';
import useLogger from '@/hooks/core/use-logger';

const useTrajectoryUpdates = () => {
    const logger = useLogger('use-trajectory-updates');

    // Helper function to handle fetching and adding a trajectory to store when it's missing
    const fetchAndAddTrajectoryToStore = async(trajectoryId: string, pendingUpdate?: { status: 'queued' | 'processing' | 'rendering' | 'completed' | 'failed'; updatedAt?: string }) => {
        try{
            await useTrajectoryStore.getState().getTrajectoryById(trajectoryId);
            // After fetch, add the trajectory to the main trajectories array if not already there
            useTrajectoryStore.setState((state) => {
                // Check if trajectory is already in the array
                const exists = state.trajectories.some(t => t._id === trajectoryId);

                // Get the fetched trajectory
                const fetchedTrajectory = state.trajectory;
                if(!fetchedTrajectory || fetchedTrajectory._id !== trajectoryId){
                    return state;
                }

                // Apply pending update if provided
                let trajectoryToAdd = fetchedTrajectory;
                if(pendingUpdate){
                    trajectoryToAdd = { ...fetchedTrajectory, status: pendingUpdate.status };
                    if(pendingUpdate.updatedAt){
                        trajectoryToAdd = { ...trajectoryToAdd, updatedAt: pendingUpdate.updatedAt };
                    }
                }

                if(exists){
                    // Already there, just update it with the pending status change
                    if(pendingUpdate){
                        const updatedTrajectories = state.trajectories.map((t) =>
                            t._id === trajectoryId ? trajectoryToAdd : t
                        );
                        return {
                            trajectories: updatedTrajectories,
                            trajectory: trajectoryToAdd
                        };
                    }
                    return state;
                }

                // Add the fetched trajectory to the beginning of the array
                return {
                    trajectories: [trajectoryToAdd, ...state.trajectories],
                    trajectory: trajectoryToAdd
                };
            });
        }catch(err: any){
            logger.warn('Failed to fetch trajectory for store, will try with pending update only', { trajectoryId, error: err?.message });
            // Even if fetch fails, apply the pending update to ensure status is updated
            // This prevents the UI from getting stuck when fetch fails
            if(pendingUpdate){
                useTrajectoryStore.setState((state) => {
                    let trajectory = state.trajectories.find(t => t._id === trajectoryId);

                    if(trajectory){
                        // Trajectory exists in store, just update it
                        const updateData: any = { status: pendingUpdate.status };
                        if(pendingUpdate.updatedAt){
                            updateData.updatedAt = pendingUpdate.updatedAt;
                        }

                        const updatedTrajectories = state.trajectories.map((traj) =>
                            traj._id === trajectoryId ? { ...traj, ...updateData } : traj
                        );

                        const updatedCache: Record<string, any> = { ...state.cache };
                        Object.entries(state.cache).forEach(([key, cachedTrajectories]) => {
                            updatedCache[key] = (cachedTrajectories as any).map((t: any) =>
                                t._id === trajectoryId ? { ...t, ...updateData } : t
                            );
                        });

                        return {
                            trajectories: updatedTrajectories,
                            cache: updatedCache,
                            trajectory: state.trajectory?._id === trajectoryId
                                ? { ...state.trajectory, ...updateData } as any
                                : state.trajectory
                        };
                    }

                    // If trajectory doesn't exist and fetch failed, create a minimal entry
                    // This ensures the UI doesn't disappear even if the full fetch fails
                    const minimalTrajectory: any = {
                        _id: trajectoryId,
                        name: 'Loading...',
                        status: pendingUpdate.status,
                        updatedAt: pendingUpdate.updatedAt || new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        frames: [],
                        team: '',
                        stats: { totalFiles: 0, totalSize: 0 }
                    };

                    return {
                        trajectories: [minimalTrajectory, ...state.trajectories]
                    };
                });
            }
        }
    };

    useEffect(() => {
        // Listen for trajectory status updates
        const unsubscribeStatus = socketService.on('trajectory_status_updated', (data: any) => {
            const { trajectoryId, status, updatedAt } = data;
            logger.log('Trajectory status update received', { trajectoryId, status, updatedAt });

            // Update the trajectory in the store
            useTrajectoryStore.setState((state) => {
                let trajectory = state.trajectories.find(t => t._id === trajectoryId);

                // If trajectory not found, fetch it from server with pending status update
                if(!trajectory){
                    logger.warn('Trajectory not found in store for status update, fetching from server', { trajectoryId, status, updatedAt });
                    // Trigger fetch from server asynchronously and apply the status update once fetched
                    fetchAndAddTrajectoryToStore(trajectoryId, { status: status as any, updatedAt });
                    return state; // Don't update now, let the fetch handle it
                }

                const previousStatus = trajectory.status;
                const updateData: any = { status };
                if(updatedAt){
                    updateData.updatedAt = updatedAt;
                }

                const updatedTrajectories = state.trajectories.map((traj) =>
                    traj._id === trajectoryId ? { ...traj, ...updateData } : traj
                );

                // Also update all cache entries to keep them in sync
                const updatedCache: Record<string, any> = { ...state.cache };
                Object.entries(state.cache).forEach(([key, cachedTrajectories]) => {
                    updatedCache[key] = (cachedTrajectories as any).map((t: any) =>
                        t._id === trajectoryId ? { ...t, ...updateData } : t
                    );
                });

                logger.log('Trajectory updated in store', {
                    trajectoryId,
                    previousStatus,
                    newStatus: status
                });

                return {
                    trajectories: updatedTrajectories,
                    cache: updatedCache,
                    trajectory: state.trajectory?._id === trajectoryId
                        ? { ...state.trajectory, ...updateData } as any
                        : state.trajectory
                };
            });
        });

        // Listen for session completion events
        const unsubscribeSession = socketService.on('trajectory_session_completed', (data: any) => {
            const { trajectoryId, sessionId, totalJobs, completedAt } = data;
            logger.log('Trajectory session completed', { trajectoryId, sessionId, totalJobs, completedAt });

            // Update trajectory to 'completed' status
            useTrajectoryStore.setState((state) => {
                let trajectory = state.trajectories.find(t => t._id === trajectoryId);

                // If not found, fetch first with pending 'completed' status update
                if(!trajectory){
                    logger.warn('Trajectory not found for session completion, fetching from server', { trajectoryId });
                    fetchAndAddTrajectoryToStore(trajectoryId, { status: 'completed', updatedAt: completedAt });
                    return state;
                }

                const updateData = {
                    status: 'completed' as const,
                    updatedAt: completedAt
                };

                const updatedTrajectories = state.trajectories.map((traj) =>
                    traj._id === trajectoryId ? { ...traj, ...updateData } : traj
                );

                // Also update all cache entries
                const updatedCache: Record<string, any> = { ...state.cache };
                Object.entries(state.cache).forEach(([key, cachedTrajectories]) => {
                    updatedCache[key] = (cachedTrajectories as any).map((t: any) =>
                        t._id === trajectoryId ? { ...t, ...updateData } : t
                    );
                });

                logger.log('Trajectory marked as completed after session finish', {
                    trajectoryId,
                    sessionId,
                    totalJobs
                });

                return {
                    trajectories: updatedTrajectories,
                    cache: updatedCache,
                    trajectory: state.trajectory?._id === trajectoryId
                        ? { ...state.trajectory, ...updateData } as any
                        : state.trajectory
                };
            });
        });

        return() => {
            unsubscribeStatus();
            unsubscribeSession();
        };
    }, [logger]);
};

export default useTrajectoryUpdates;
