import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { SOCKET_CONTAINER_EVENTS } from '@/modules/socket/events/container';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type { ContainerDeployProgressEvent } from '@volt/contracts/modules/container/domain';

const DEPLOY_STEPS = [
    {
        step: 'accepted',
        message: 'Deployment request accepted.'
    },
    {
        step: 'pulling-image',
        message: 'Pulling image. This can take a while the first time.'
    },
    {
        step: 'creating-container',
        message: 'Creating container...'
    },
    {
        step: 'starting-container',
        message: 'Starting container...'
    },
    {
        step: 'container-ready',
        message: 'Container is ready.'
    }
];

/**
 * Follows the deployment of a single container over the socket, exposing a progress
 * message and completion rate for the operation it started.
 */
const useContainerDeployProgress = () => {
    const [operationId, setOperationId] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [rate, setRate] = useState<number | null>(null);
    const [startedAt, setStartedAt] = useState<number | null>(null);

    useSocketEvent<ContainerDeployProgressEvent>(SOCKET_CONTAINER_EVENTS.DEPLOY_PROGRESS, (event) => {
        if (event.operationId !== operationId) {
            return;
        }

        const stepIndex = DEPLOY_STEPS.findIndex((deployStep) => deployStep.step === event.step);

        setMessage(DEPLOY_STEPS[stepIndex]?.message
            ?? (event.step ? `Deploying container: ${event.step}` : 'Deploying container...'));

        if (stepIndex >= 0) {
            setRate((stepIndex + 1) / DEPLOY_STEPS.length);
        }
    }, {
        enabled: !!operationId
    });

    const startTracking = (): string => {
        const nextOperationId = uuidv4();
        setOperationId(nextOperationId);
        setMessage('Preparing deployment...');
        setRate(null);
        setStartedAt(Date.now());
        return nextOperationId;
    };

    const stopTracking = () => {
        setOperationId(null);
        setStartedAt(null);
        setRate(null);
    };

    return {
        message,
        rate,
        startedAt,
        startTracking,
        stopTracking
    };
};

export default useContainerDeployProgress;
