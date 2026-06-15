import { useEffect, useRef } from 'react';
import { useExecutePluginMutation } from '@/modules/plugin/hooks/plugin/queries';
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
 * clears the intent atomically, so a re-render can never double-dispatch.
 */
const useCloneIntentRunner = ({ trajectoryId, isForeignTrajectory }: UseCloneIntentRunnerArgs): void => {
    const executePluginMutation = useExecutePluginMutation();
    const consumeIntent = useTrajectoryCloneFlowStore((s) => s.consumeIntent);
    const removeEntry = useTrajectoryCloneFlowStore((s) => s.removeEntry);
    const dispatchedRef = useRef(false);

    useEffect(() => {
        if (!trajectoryId || isForeignTrajectory || dispatchedRef.current) return;
        const intent = consumeIntent(trajectoryId);
        if (!intent) return;
        dispatchedRef.current = true;
        executePluginMutation.mutateAsync({
            pluginId: intent.pluginId,
            trajectoryId,
            teamClusterId: intent.targetClusterId,
            config: intent.config,
            selectedTimesteps: intent.selectedTimesteps,
            timestep: intent.timestep
        })
            .catch(() => undefined)
            .finally(() => { removeEntry(trajectoryId); });
    }, [trajectoryId, isForeignTrajectory, consumeIntent, removeEntry, executePluginMutation]);
};

export default useCloneIntentRunner;
