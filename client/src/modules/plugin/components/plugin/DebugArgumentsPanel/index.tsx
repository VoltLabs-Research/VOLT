import { Button, IconButton } from '@/shared/presentation/primitives';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import useDebugTrajectorySelector from '@/modules/plugin/hooks/plugin/use-debug-trajectory-selector';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { usePluginDebugStore } from '@/modules/plugin/stores/plugin/use-plugin-debug-store';
import {
    collectVisibleDefaultArgumentValues,
    getUserConfigurableArguments
} from '@/modules/plugin/utilities/plugin/argument-values';
import { X, Play, Settings2 } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';
import type { SelectOption } from '@/shared/presentation/primitives';
import './DebugArgumentsPanel.css';

interface DebugArgumentsPanelProps {
    onStart: () => void;
    canStart: boolean;
};

interface ArgumentsNodeData {
    arguments?: {
        arguments?: IArgumentDefinition[];
    };
};

const DebugArgumentsPanel = ({ onStart, canStart }: DebugArgumentsPanelProps) => {
    const nodes = usePluginBuilderStore((s) => s.nodes);
    const {
        debugConfig,
        showArgumentsPanel,
        setDebugConfigField,
        setDebugConfig,
        setShowArgumentsPanel,
        isDebugging,
        isStarting
    } = usePluginDebugStore();

    const { selectedTrajectory } = useDebugTrajectorySelector();

    // Extract configurable arguments from the Arguments node in the workflow
    const configurableArgs = useMemo(() => {
        const argsNode = nodes.find((n) => n.type === NodeType.ARGUMENTS);
        if (!argsNode) return [];

        const argsNodeData = argsNode.data as ArgumentsNodeData;
        const argsDef = argsNodeData.arguments?.arguments;
        if (!argsDef) return [];

        return getUserConfigurableArguments(argsDef);
    }, [nodes]);

    useEffect(() => {
        if (configurableArgs.length === 0) return;

        const defaultConfig = collectVisibleDefaultArgumentValues(configurableArgs, debugConfig);
        const newConfig: Record<string, unknown> = { ...debugConfig };
        let hasChanges = false;

        for (const [key, value] of Object.entries(defaultConfig)) {
            if (newConfig[key] === undefined) {
                newConfig[key] = value;
                hasChanges = true;
            }
        }

        if (hasChanges) {
            setDebugConfig(newConfig);
        }
    }, [configurableArgs, debugConfig, setDebugConfig]);

    const handleFieldChange = useCallback((key: string, value: unknown) => {
        setDebugConfigField(key, value);
    }, [setDebugConfigField]);

    const handleStartClick = useCallback(() => {
        setShowArgumentsPanel(false);
        onStart();
    }, [onStart, setShowArgumentsPanel]);

    const handleClose = useCallback(() => {
        setShowArgumentsPanel(false);
    }, [setShowArgumentsPanel]);

    const frameOptions = useMemo<SelectOption[]>(() => {
        return (selectedTrajectory?.frames ?? []).map((frame, index) => ({
            value: String(frame.timestep),
            title: `Frame ${index + 1} (t=${frame.timestep})`
        }));
    }, [selectedTrajectory]);

    if (configurableArgs.length === 0) return null;

    if (!showArgumentsPanel) return null;

    return (
        <div className='p-absolute z-10 center-x panel-floating radius-md overflow-hidden d-flex column debug-arguments-panel glass-bg'>
            <div className='d-flex content-between items-center f-shrink-0 debug-arguments-panel-header'>
                <div className='d-flex items-center gap-05'>
                    <Settings2 size={14} />
                    <p className='font-size-2 font-weight-6'>
                        Debug Arguments
                    </p>
                </div>
                <IconButton
                    variant='ghost'
                    size='sm'
                    onClick={handleClose}
                >
                    <X size={14} />
                </IconButton>
            </div>

            <div className='d-flex column gap-05 y-auto flex-1 min-h-0 debug-arguments-panel-body'>
                <ArgumentFieldsRenderer
                    arguments={configurableArgs}
                    values={debugConfig}
                    onChange={handleFieldChange}
                    frameOptions={frameOptions}
                    emptyMessage='No arguments configured.'
                />
            </div>

            <div className='f-shrink-0 debug-arguments-panel-footer'>
                <Button
                    variant='outline'
                    intent='white'
                    size='sm'
                    block
                    onClick={handleStartClick}
                    disabled={!canStart || isDebugging || isStarting}
                >
                    <Play size={12} />
                    Start Debug
                </Button>
            </div>
        </div>
    );
};

export default DebugArgumentsPanel;
