import { useCallback, useEffect, useRef, useState } from 'react';
import { sileo } from 'sileo';

import type { ModifierOption } from '../utilities/modifier-registry';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';

export enum ExecState {
    Idle = 'idle',
    Loading = 'loading',
    Success = 'success',
    Error = 'error'
};

interface ExecutePluginArgs {
    pluginId: string;
    trajectoryId: string;
    config: Record<string, unknown>;
    timestep?: number;
};

interface UsePluginExecutionArgs {
    trajectoryId?: string;
    currentTimestep?: number;
    getPluginArguments: (pluginId: string) => IArgumentDefinition[];
    executePlugin: (args: ExecutePluginArgs) => Promise<unknown>;
    pluginConfigs?: Record<string, Record<string, unknown>>;
};

const usePluginExecution = ({
    trajectoryId,
    currentTimestep,
    getPluginArguments,
    executePlugin,
    pluginConfigs
}: UsePluginExecutionArgs) => {
    const [execStates, setExecStates] = useState<Map<string, ExecState>>(new Map());
    const successTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    useEffect(() => () => {
        successTimers.current.forEach(clearTimeout);
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
        setExecStates((prev) => new Map(prev).set(modId, ExecState.Loading));

        const existing = successTimers.current.get(modId);
        if (existing) {
            clearTimeout(existing);
        }

        try {
            const args = getPluginArguments(option.pluginModifierId);
            const userConfig = pluginConfigs?.[option.pluginModifierId] || {};
            const config: Record<string, unknown> = {};

            args.forEach((arg) => {
                const override = userConfig[arg.argument];
                let value = arg.value ?? arg.default;
                if (override !== undefined) {
                    value = override;
                }

                if (value !== undefined) {
                    config[arg.argument] = value;
                }
            });

            await executePlugin({
                pluginId: option.pluginModifierId,
                trajectoryId,
                config,
                timestep: currentTimestep
            });

            setExecStates((prev) => new Map(prev).set(modId, ExecState.Success));
            clearExecStateLater(modId);
        } catch {
            sileo.error({ title: 'Plugin execution failed' });
            setExecStates((prev) => new Map(prev).set(modId, ExecState.Error));
            clearExecStateLater(modId);
        }
    }, [trajectoryId, currentTimestep, getPluginArguments, executePlugin, pluginConfigs, clearExecStateLater]);

    return { execStates, handleExecutePlugin };
};

export default usePluginExecution;
