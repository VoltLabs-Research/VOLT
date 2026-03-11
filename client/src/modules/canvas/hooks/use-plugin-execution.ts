import { sileo } from 'sileo';
import { useCallback, useEffect, useRef, useState } from 'react';

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
    teamClusterId: string;
    config: Record<string, unknown>;
    selectedTimesteps?: number[];
    timestep?: number;
};

interface UsePluginExecutionArgs {
    trajectoryId?: string;
    currentTimestep?: number;
    getPluginArguments: (pluginId: string) => IArgumentDefinition[];
    getSelectedTeamClusterId: (option: ModifierOption) => string;
    getSelectedTimesteps: (pluginId: string) => number[] | undefined;
    executePlugin: (args: ExecutePluginArgs) => Promise<unknown>;
    pluginConfigs?: Record<string, Record<string, unknown>>;
};

const usePluginExecution = ({
    trajectoryId,
    currentTimestep,
    getPluginArguments,
    getSelectedTeamClusterId,
    getSelectedTimesteps,
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
            const selectedTeamClusterId = getSelectedTeamClusterId(option);
            const selectedTimesteps = getSelectedTimesteps(option.pluginModifierId);
            const config: Record<string, unknown> = {};

            if (!selectedTeamClusterId) {
                throw new Error('Missing team cluster selection');
            }

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
                teamClusterId: selectedTeamClusterId,
                config,
                selectedTimesteps,
                timestep: currentTimestep
            });

            setExecStates((prev) => new Map(prev).set(modId, ExecState.Success));
            clearExecStateLater(modId);
        } catch {
            sileo.error({ title: 'Plugin execution failed' });
            setExecStates((prev) => new Map(prev).set(modId, ExecState.Error));
            clearExecStateLater(modId);
        }
    }, [
        trajectoryId,
        currentTimestep,
        getPluginArguments,
        getSelectedTeamClusterId,
        getSelectedTimesteps,
        executePlugin,
        pluginConfigs,
        clearExecStateLater
    ]);

    return { execStates, handleExecutePlugin };
};

export default usePluginExecution;
