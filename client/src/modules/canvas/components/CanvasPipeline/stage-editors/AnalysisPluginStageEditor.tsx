import { useCanvasPipelineStore } from '../../../store/canvas-pipeline';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { getUserConfigurableArguments } from '@/modules/plugin/utils/plugin/argument-values';
import { extractTrajectoryTimesteps } from '../../../utils/selected-timestep-analysis';
import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import { Button, Row, Stack, Text } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { useCallback, useMemo } from 'react';
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
    const stage = useCanvasPipelineStore((s) =>
        (trajectoryId ? s.byTrajectory[trajectoryId] : undefined)?.find((entry) => entry.id === stageId)
    );
    const updateStageConfig = useCanvasPipelineStore((s) => s.updateStageConfig);

    const config = stage?.config as AnalysisPluginStageConfig | undefined;
    const pluginId = config?.pluginId;

    const { modifiers, getPluginArguments } = usePluginSelectors();

    const availableTimesteps = useMemo(() => extractTrajectoryTimesteps(trajectory), [trajectory]);
    const frameOptions: SelectOption[] = useMemo(
        () => availableTimesteps.map((t) => ({
            value: String(t),
            title: `t=${t}`
        })),
        [availableTimesteps]
    );

    const selectedModifier = useMemo(() => {
        if (!pluginId) return null;
        return modifiers.find((m) => m.pluginId === pluginId) ?? null;
    }, [pluginId, modifiers]);

    const argValues = useMemo(() => config?.argValues ?? {}, [config?.argValues]);

    const handleConfigChange = useCallback((key: string, value: unknown) => {
        if (!pluginId) return;
        updateStageConfig(
            stageId,
            {
                argValues: {
                    ...argValues,
                    [key]: value
                }
            } as Partial<AnalysisPluginStageConfig>,
            trajectoryId
        );
    }, [argValues, pluginId, stageId, trajectoryId, updateStageConfig]);

    if (!config || !pluginId) {
        return (
            <Row justify='center'>
                <Text size='sm' tone='muted'>This analysis stage is misconfigured.</Text>
            </Row>
        );
    }

    if (!selectedModifier) {
        return (
            <Row justify='center'>
                <Text size='sm' tone='muted'>Plugin “{pluginId}” is not available in this team.</Text>
            </Row>
        );
    }

    const args = getUserConfigurableArguments(getPluginArguments(pluginId));

    return (
        <Stack gap='075'>
            <ArgumentFieldsRenderer
                arguments={args}
                values={argValues}
                onChange={handleConfigChange}
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
