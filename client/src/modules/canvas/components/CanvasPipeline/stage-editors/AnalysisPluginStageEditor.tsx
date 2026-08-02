import useStageConfig from '@/modules/canvas/hooks/use-stage-config';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { getUserConfigurableArguments } from '@/modules/plugin/utils/plugin/argument-values';
import { extractTrajectoryTimesteps } from '../../../utils/selected-timestep-analysis';
import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import { Button, Row, Stack, Text } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { useMemo } from 'react';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { AnalysisPluginStageConfig } from '../../../store/canvas-pipeline';

interface AnalysisPluginStageEditorProps {
    stageId: string;
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    onSave?: () => void;
}

const AnalysisPluginStageEditor = ({
    stageId,
    trajectory,
    trajectoryId,
    onSave
}: AnalysisPluginStageEditorProps) => {
    const { config, patch } = useStageConfig<AnalysisPluginStageConfig>(stageId, trajectoryId);
    const { modifiers, getPluginArguments } = usePluginSelectors();

    // Memoised because a trajectory can carry thousands of timesteps.
    const frameOptions: SelectOption[] = useMemo(
        () => extractTrajectoryTimesteps(trajectory).map((t) => ({
            value: String(t),
            title: `t=${t}`
        })),
        [trajectory]
    );

    if (!config?.pluginId) {
        return (
            <Row justify='center'>
                <Text size='sm' tone='muted'>This analysis stage is misconfigured.</Text>
            </Row>
        );
    }

    const { pluginId, argValues } = config;

    if (!modifiers.some((m) => m.pluginId === pluginId)) {
        return (
            <Row justify='center'>
                <Text size='sm' tone='muted'>Plugin “{pluginId}” is not available in this team.</Text>
            </Row>
        );
    }

    return (
        <Stack gap='075'>
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
            <Button
                variant='solid'
                intent='brand'
                size='sm'
                shape='rounded'
                block
                onClick={() => onSave?.()}
            >
                Save
            </Button>
        </Stack>
    );
};

export default AnalysisPluginStageEditor;
