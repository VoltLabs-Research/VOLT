import { useEffect, useRef } from 'react';
import { useExecutePipelineMutation } from '@/modules/plugin/hooks/plugin/queries';
import {
    useTrajectoryCloneFlowStore
} from '../store/use-trajectory-clone-flow-store';

interface UseCloneIntentRunnerArgs {
    trajectoryId?: string;
    isForeignTrajectory: boolean;
}

const useCloneIntentRunner = ({ trajectoryId, isForeignTrajectory }: UseCloneIntentRunnerArgs): void => {
    const executePipelineMutation = useExecutePipelineMutation();
    const consumeIntent = useTrajectoryCloneFlowStore((s) => s.consumeIntent);
    const removeEntry = useTrajectoryCloneFlowStore((s) => s.removeEntry);
    const dispatchedRef = useRef(false);

    useEffect(() => {
        if (!trajectoryId || isForeignTrajectory || dispatchedRef.current) return;
        const intent = consumeIntent(trajectoryId);
        if (!intent) return;
        dispatchedRef.current = true;
        executePipelineMutation.mutateAsync({
            trajectoryId,
            teamClusterId: intent.targetClusterId,
            selectedTimesteps: intent.selectedTimesteps,
            timestep: intent.timestep,
            stages: [{ kind: 'plugin', pluginId: intent.pluginId, config: intent.config }]
        })
            .catch(() => undefined)
            .finally(() => { removeEntry(trajectoryId); });
    }, [trajectoryId, isForeignTrajectory, consumeIntent, removeEntry, executePipelineMutation]);
};

export default useCloneIntentRunner;
