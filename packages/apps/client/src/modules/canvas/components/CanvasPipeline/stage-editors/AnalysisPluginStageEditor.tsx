import useStageConfig from '@/modules/canvas/hooks/use-stage-config';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { getUserConfigurableArguments } from '@/modules/plugin/utils/plugin/argument-values';
import { extractTrajectoryTimesteps } from '@/modules/canvas/utils/selected-timestep-analysis';
import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import type { SelectOption } from '@/shared/contracts/form-field';
import { useMemo } from 'react';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { AnalysisPluginStageConfig } from '@/modules/canvas/store/canvas-pipeline';

interface AnalysisPluginStageEditorProps {
    stageId: string;
    trajectory?: Trajectory | null;
    trajectoryId?: string;
}

const AnalysisPluginStageEditor = ({
    stageId,
    trajectory,
    trajectoryId
}: AnalysisPluginStageEditorProps) => {
    const { config, patch } = useStageConfig<AnalysisPluginStageConfig>(stageId, trajectoryId);
    const { modifiers, getPluginArguments } = usePluginSelectors();

    const frameOptions: SelectOption[] = useMemo(
        () => extractTrajectoryTimesteps(trajectory).map((t) => ({
            value: String(t),
            title: `t=${t}`
        })),
        [trajectory]
    );

    if (!config?.pluginId) {
        return (
            <div className='flex flex-row items-center justify-center'>
                <span className='text-xs text-muted'>This analysis stage is misconfigured.</span>
            </div>
        );
    }

    const { pluginId, argValues } = config;

    if (!modifiers.some((m) => m.pluginId === pluginId)) {
        return (
            <div className='flex flex-row items-center justify-center'>
                <span className='text-xs text-muted'>Plugin “{pluginId}” is not available in this team.</span>
            </div>
        );
    }

    // Each field writes to the stage as it changes, so there is nothing to save; the panel scrolls it.
    return (
        <div className='flex min-w-0 flex-col gap-2'>
            <ArgumentFieldsRenderer
                arguments={getUserConfigurableArguments(getPluginArguments(pluginId))}
                values={argValues}
                onChange={(key, value) => patch({
                    argValues: {
                        ...argValues,
                        [key]: value
                    }
                })}
                frameOptions={frameOptions}
                emptyMessage='No arguments configured.'
            />
        </div>
    );
};

export default AnalysisPluginStageEditor;
