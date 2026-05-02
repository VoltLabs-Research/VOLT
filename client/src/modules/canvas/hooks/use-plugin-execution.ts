import { ArgumentType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { resolveArgumentRuntimeValue } from '@/modules/plugin/utilities/plugin/argument-values';
import { getVisibleArguments } from '@/modules/plugin/utilities/plugin/argument-visibility';
import { sileo } from 'sileo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePendingPluginExecutionsStore } from '../stores/use-pending-plugin-executions-store';

import type { ModifierOption } from '../utilities/modifier-registry';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';

export enum ExecState {
    Idle = 'idle',
    Loading = 'loading',
    Success = 'success',
    Error = 'error'
}

const RESERVED_RUNTIME_ARGUMENTS = {
    selectedTimesteps: 'selectedTimesteps'
} as const;

const injectSelectedTimestepsRuntimeArgument = (
    args: IArgumentDefinition[],
    selectedTimesteps: number[] | undefined
): IArgumentDefinition[] => {
    if (!selectedTimesteps?.length) {
        return args;
    }

    const hasReservedArgument = args.some((argument) => argument.argument === RESERVED_RUNTIME_ARGUMENTS.selectedTimesteps);
    if (hasReservedArgument) {
        return args;
    }

    return [
        ...args,
        {
            argument: RESERVED_RUNTIME_ARGUMENTS.selectedTimesteps,
            type: ArgumentType.LIST,
            label: 'Selected Timesteps',
            value: selectedTimesteps.map((timestep) => ({ value: timestep })),
            listArguments: [{
                argument: 'value',
                type: ArgumentType.NUMBER,
                label: 'Timestep'
            }]
        }
    ];
};

interface ExecutePluginArgs {
    pluginId: string;
    trajectoryId: string;
    teamClusterId: string;
    config: Record<string, unknown>;
    selectedTimesteps?: number[];
    timestep?: number;
}

interface ExecutePluginResult {
    analysisId: string;
}

interface BeforeExecuteResult {
    proceed: boolean;
}

interface UsePluginExecutionArgs {
    trajectoryId?: string;
    currentTimestep?: number;
    getPluginArguments: (pluginId: string) => IArgumentDefinition[];
    getSelectedTeamClusterId: (option: ModifierOption) => string;
    getSelectedTimesteps: (pluginId: string) => number[] | undefined;
    executePlugin: (args: ExecutePluginArgs) => Promise<ExecutePluginResult>;
    pluginConfigs?: Record<string, Record<string, unknown>>;
    beforeExecute?: (option: ModifierOption) => Promise<BeforeExecuteResult>;
}

const usePluginExecution = ({
    trajectoryId,
    currentTimestep,
    getPluginArguments,
    getSelectedTeamClusterId,
    getSelectedTimesteps,
    executePlugin,
    pluginConfigs,
    beforeExecute
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
        const pluginName = option.title;
        setExecStates((prev) => new Map(prev).set(modId, ExecState.Loading));

        const existing = successTimers.current.get(modId);
        if (existing) {
            clearTimeout(existing);
        }

        try {
            if (beforeExecute) {
                const result = await beforeExecute(option);
                if (!result.proceed) {
                    setExecStates((prev) => new Map(prev).set(modId, ExecState.Success));
                    clearExecStateLater(modId);
                    return;
                }
            }

            const userConfig = pluginConfigs?.[option.pluginModifierId] || {};
            const selectedTeamClusterId = getSelectedTeamClusterId(option);
            const selectedTimesteps = getSelectedTimesteps(option.pluginModifierId);
            const args = injectSelectedTimestepsRuntimeArgument(
                getPluginArguments(option.pluginModifierId),
                selectedTimesteps
            );
            const visibleArgs = getVisibleArguments(args, userConfig);
            const config: Record<string, unknown> = {};

            if (!selectedTeamClusterId) {
                throw new Error('Missing team cluster selection');
            }

            visibleArgs.forEach((arg) => {
                const override = userConfig[arg.argument];
                let value = arg.value;
                if (value === undefined && override !== undefined) {
                    value = override;
                }
                if (value === undefined) {
                    value = arg.default;
                }

                if (value !== undefined) {
                    config[arg.argument] = resolveArgumentRuntimeValue(arg, value);
                }
            });

            const result = await executePlugin({
                pluginId: option.pluginModifierId,
                trajectoryId,
                teamClusterId: selectedTeamClusterId,
                config,
                selectedTimesteps,
                timestep: currentTimestep
            });

            usePendingPluginExecutionsStore.getState().register({
                analysisId: result.analysisId,
                trajectoryId,
                pluginName,
                timestep: currentTimestep,
                autoSelect: true
            });

            sileo.success({
                title: `${pluginName} is being computed`
            });

            setExecStates((prev) => new Map(prev).set(modId, ExecState.Success));
            clearExecStateLater(modId);
        } catch {
            sileo.error({ title: `${pluginName} failed to start`, description: 'Please try again.' });
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
        beforeExecute,
        clearExecStateLater
    ]);

    return { execStates, handleExecutePlugin };
};

export default usePluginExecution;
