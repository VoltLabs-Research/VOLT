import { useEffect, useRef } from 'react';
import { useExecutePipelineMutation } from '@/modules/plugin/hooks/plugin/queries';
import {
    useTrajectoryCloneFlowStore
} from '../stores/use-trajectory-clone-flow-store';

interface UseCloneIntentRunnerArgs {
    trajectoryId?: string;
    isForeignTrajectory: boolean;
}

/**
 * Runs the pending "clone & run" intent for the current trajectory once, after a
 * foreign-trajectory clone has landed the user on the destination canvas. Lifted
 * out of the old AnalyzeLauncher modal lifecycle (which only fired while the modal
 * was open) into an always-mounted hook on the pipeline panel. `consumeIntent`
 * clears the intent atomically, so a re-render can never double-dispatch. The run
 * is dispatched as a single-stage pipeline — the only execution path now.
 */
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
