import { useMemo } from 'react';
import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { getUserConfigurableArguments } from '@/modules/plugin/utils/plugin/argument-values';
import { extractTrajectoryTimesteps } from '../../utils/selected-timestep-analysis';
import { useCanvasPipelineStore, useStageEdits } from '../../store/canvas-pipeline';

import type { SelectOption } from '@/shared/contracts/form-field';
import type { PipelineRunStage } from '@volt/contracts/modules/plugin/pipeline-run';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface SavedStageParametersProps {
    pipelineKey: string;
    stage: PipelineRunStage & { pluginId: string };
    trajectory?: Trajectory | null;
}

// A saved stage's parameters, editable: they start from what it ran with, and a change is kept
// apart from the run until the pipeline runs again, as a new one.
const SavedStageParameters = ({ pipelineKey, stage, trajectory }: SavedStageParametersProps) => {
    const { getPluginArguments } = usePluginSelectors();
    const edit = useStageEdits(pipelineKey)[stage.index];
    const setStageEdit = useCanvasPipelineStore((s) => s.setStageEdit);
    const values = edit ?? stage.config;

    const frameOptions: SelectOption[] = useMemo(
        () => extractTrajectoryTimesteps(trajectory).map((t) => ({
            value: String(t),
            title: `t=${t}`
        })),
        [trajectory]
    );

    return (
        <div className='flex min-w-0 flex-col gap-2'>
            <ArgumentFieldsRenderer
                arguments={getUserConfigurableArguments(getPluginArguments(stage.pluginId))}
                values={values}
                onChange={(key, value) => setStageEdit(pipelineKey, stage.index, {
                    ...values,
                    [key]: value
                })}
                frameOptions={frameOptions}
                emptyMessage='No arguments configured.'
            />
        </div>
    );
};

export default SavedStageParameters;
