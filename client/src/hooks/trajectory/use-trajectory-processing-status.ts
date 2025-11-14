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

import { useMemo } from 'react';
import useTrajectoryStore from '@/stores/trajectories';
import useLogger from '@/hooks/core/use-logger';

export type ProcessingStage = 
    | 'idle'
    | 'queued' 
    | 'processing' 
    | 'rendering' 
    | 'completed';

interface TrajectoryProcessingStatus {
    stage: ProcessingStage;
    message: string;
    isProcessing: boolean;
    jobId?: string;
    queueType?: string;
}

interface UseTrajectoryProcessingStatusOptions {
    trajectoryId: string;
    enabled?: boolean;
}

const determineStage = (trajectoryStatus?: string): ProcessingStage => {
    if (!trajectoryStatus) return 'idle';
    
    switch (trajectoryStatus.toLowerCase()) {
        case 'queued':
            return 'queued';
        case 'processing':
            return 'processing';
        case 'rendering':
            return 'rendering';
        case 'completed':
            return 'completed';
        case 'failed':
            return 'idle';
        default:
            return 'idle';
    }
};

const getMessageForStage = (stage: ProcessingStage): string => {
    switch (stage) {
        case 'idle':
            return '';
        case 'queued':
            return 'Queued...';
        case 'processing':
            return 'Processing frames...';
        case 'rendering':
            return 'Rendering...';
        case 'completed':
            return 'Complete';
        default:
            return 'Processing...';
    }
};

export const useTrajectoryProcessingStatus = ({
    trajectoryId,
    enabled = true
}: UseTrajectoryProcessingStatusOptions): TrajectoryProcessingStatus => {
    const logger = useLogger('use-trajectory-processing-status');
    
    // CRÍTICO: Observar el status directamente desde el store
    // Esto se actualiza automáticamente cuando useTrajectoryUpdates recibe eventos WebSocket
    const trajectoryStatus = useTrajectoryStore((state) => {
        const trajectory = state.trajectories.find(t => t._id === trajectoryId);
        return trajectory?.status;
    });

    console.log('trajectoryId:', trajectoryId, 'trajectoryStatus:', trajectoryStatus);

    const status = useMemo(() => {
        console.log('status called');
        if (!enabled || !trajectoryId) {
            return {
                stage: 'idle' as ProcessingStage,
                message: '',
                isProcessing: false
            };
        }

        // Determinar el stage basado en el status de la trayectoria desde el store
        const stage = determineStage(trajectoryStatus);
        const message = getMessageForStage(stage);
        const isProcessing = stage !== 'idle' && stage !== 'completed';

        logger.log(`Processing status for trajectory ${trajectoryId}:`, {
            trajectoryId,
            stage,
            isProcessing,
            message,
            trajectoryStatus: trajectoryStatus || 'none'
        });

        return {
            stage,
            message,
            isProcessing
        };
    }, [trajectoryId, trajectoryStatus, enabled, logger]);

    return status;
};

export default useTrajectoryProcessingStatus;