import { useCallback, useEffect, useRef, useState } from 'react';
import type { IArgumentDefinition } from '@/modules/plugin/domain/entities';
import type { ModifierOption } from '../../modifiers/registry';

export type ExecState = 'idle' | 'loading' | 'success' | 'error';

interface UsePluginExecutionArgs {
    trajectoryId?: string;
    currentTimestep?: number;
    getPluginArguments: (pluginId: string) => IArgumentDefinition[];
    pluginRepository: { execute: (args: { pluginId: string; trajectoryId: string; config: Record<string, unknown>; timestep?: number }) => Promise<unknown> };
    pluginConfigs?: Record<string, Record<string, unknown>>;
}

const usePluginExecution = ({
    trajectoryId,
    currentTimestep,
    getPluginArguments,
    pluginRepository,
    pluginConfigs
}: UsePluginExecutionArgs) => {
    const [execStates, setExecStates] = useState<Map<string, ExecState>>(new Map());
    const successTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    useEffect(() => () => {
        successTimers.current.forEach((t) => clearTimeout(t));
    }, []);

    const clearExecStateLater = useCallback((modId: string) => {
        const timer = setTimeout(() => {
            setExecStates((prev) => {
                const next = new Map(prev);
                next.delete(modId);
                return next;
            });
            successTimers.current.delete(modId);
        }, 3000);
        successTimers.current.set(modId, timer);
    }, []);

    const handleExecutePlugin = useCallback(async (option: ModifierOption) => {
        if (!option.isPlugin || !option.pluginModifierId || !trajectoryId) return;

        const modId = option.modifierId;
        setExecStates((prev) => new Map(prev).set(modId, 'loading'));

        const existing = successTimers.current.get(modId);
        if (existing) clearTimeout(existing);

        try {
            const args = getPluginArguments(option.pluginModifierId);
            const userConfig = pluginConfigs?.[option.pluginModifierId] || {};
            const config: Record<string, unknown> = {};
            args.forEach((arg) => {
                const override = userConfig[arg.argument];
                const val = override !== undefined ? override : (arg.value ?? arg.default);
                if (val !== undefined) config[arg.argument] = val;
            });

            await pluginRepository.execute({
                pluginId: option.pluginModifierId,
                trajectoryId,
                config,
                timestep: currentTimestep
            });

            setExecStates((prev) => new Map(prev).set(modId, 'success'));
            clearExecStateLater(modId);
        } catch (err) {
            console.error('[RightPanel] plugin execution failed', err);
            setExecStates((prev) => new Map(prev).set(modId, 'error'));
            clearExecStateLater(modId);
        }
    }, [trajectoryId, currentTimestep, getPluginArguments, pluginRepository, pluginConfigs, clearExecStateLater]);

    return { execStates, handleExecutePlugin };
};

export default usePluginExecution;
