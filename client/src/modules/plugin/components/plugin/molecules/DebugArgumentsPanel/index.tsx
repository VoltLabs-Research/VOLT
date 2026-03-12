import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import useDebugTrajectorySelector from '@/modules/plugin/hooks/plugin/use-debug-trajectory-selector';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { usePluginDebugStore } from '@/modules/plugin/stores/plugin/use-plugin-debug-store';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import IconButton from '@/shared/presentation/components/IconButton';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { X, Play, Settings2 } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';
import type { TimestepInfo } from '@/modules/trajectory/api/entities/trajectory';
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

interface DebugConfigField {
    key: string;
    label: string;
    fieldKey: string;
    type: 'input' | 'select' | 'checkbox';
    options?: Array<{ value: string; title: string }>;
    inputProps?: {
        type: 'number' | 'text';
        step?: number;
        min?: number;
        max?: number;
    };
};

const DebugArgumentsPanel = ({ onStart, canStart }: DebugArgumentsPanelProps) => {
    const nodes = usePluginBuilderStore((s) => s.nodes);
    const debugConfig = usePluginDebugStore((state) => state.debugConfig);
    const showArgumentsPanel = usePluginDebugStore((state) => state.showArgumentsPanel);
    const setDebugConfigField = usePluginDebugStore((state) => state.setDebugConfigField);
    const setDebugConfig = usePluginDebugStore((state) => state.setDebugConfig);
    const setShowArgumentsPanel = usePluginDebugStore((state) => state.setShowArgumentsPanel);
    const isDebugging = usePluginDebugStore((state) => state.isDebugging);
    const isStarting = usePluginDebugStore((state) => state.isStarting);

    const { selectedTrajectory } = useDebugTrajectorySelector();

    // Extract configurable arguments from the Arguments node in the workflow
    const configurableArgs = useMemo(() => {
        const argsNode = nodes.find((n) => n.type === NodeType.ARGUMENTS);
        if (!argsNode) return [];

        const argsNodeData = argsNode.data as ArgumentsNodeData;
        const argsDef = argsNodeData.arguments?.arguments;
        if (!argsDef) return [];

        return argsDef.filter((arg) => arg.value === undefined);
    }, [nodes]);

    useEffect(() => {
        if (configurableArgs.length === 0) return;

        const newConfig: Record<string, unknown> = { ...debugConfig };
        let hasChanges = false;

        for (const argDef of configurableArgs) {
            const key = argDef.argument;
            if (newConfig[key] === undefined && argDef.default !== undefined) {
                newConfig[key] = argDef.default;
                hasChanges = true;
            }
        }

        if (hasChanges) {
            setDebugConfig(newConfig);
        }
    }, [configurableArgs, debugConfig, setDebugConfig]);

    const handleFieldChange = useCallback((key: string, value: string | number | boolean) => {
        setDebugConfigField(key, value);
    }, [setDebugConfigField]);

    const getPrimitiveFieldValue = useCallback((value: unknown): string | number | boolean => {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }

        return '';
    }, []);

    const handleStartClick = useCallback(() => {
        setShowArgumentsPanel(false);
        onStart();
    }, [onStart, setShowArgumentsPanel]);

    const handleClose = useCallback(() => {
        setShowArgumentsPanel(false);
    }, [setShowArgumentsPanel]);

    const configFields = useMemo(() => {
        return configurableArgs.map((argDef): DebugConfigField => {
            const key = argDef.argument;
            const field: DebugConfigField = {
                key,
                label: argDef.label || key,
                fieldKey: key,
                type: 'input'
            };

            switch (argDef.type) {
                case 'select':
                    field.type = 'select';
                    field.options = (argDef.options || []).map((opt) => ({
                        value: opt.key,
                        title: opt.label
                    }));
                    break;

                case 'frame':
                    field.type = 'select';
                    field.options = (selectedTrajectory?.frames || []).map((frame: TimestepInfo, index: number) => ({
                        value: String(frame.timestep),
                        title: `Frame ${index + 1} (t=${frame.timestep})`
                    }));
                    if (field.options.length === 0) {
                        field.options = [{ value: '0', title: 'Default (First Frame)' }];
                    }
                    break;

                case 'number':
                    field.type = 'input';
                    field.inputProps = {
                        type: 'number',
                        step: argDef.step || 0.1,
                        min: argDef.min,
                        max: argDef.max
                    };
                    break;

                case 'boolean':
                    field.type = 'checkbox';
                    break;

                default:
                    field.type = 'input';
                    field.inputProps = { type: 'text' };
            }

            return field;
        });
    }, [configurableArgs, selectedTrajectory]);

    if (configurableArgs.length === 0) return null;

    if (!showArgumentsPanel) return null;

    return (
        <Container className='p-absolute z-10 center-x panel-floating radius-md overflow-hidden d-flex column debug-arguments-panel'>
            <Container className='d-flex content-between items-center f-shrink-0 debug-arguments-panel-header'>
                <Container className='d-flex items-center gap-05'>
                    <Settings2 size={14} />
                    <Paragraph className='font-size-2 font-weight-6'>
                        Debug Arguments
                    </Paragraph>
                </Container>
                <IconButton
                    variant='ghost'
                    size='sm'
                    onClick={handleClose}
                >
                    <X size={14} />
                </IconButton>
            </Container>

            <Container className='d-flex column gap-05 y-auto flex-1 min-h-0 scrollbar-thin debug-arguments-panel-body'>
                {configFields.map((field) => (
                    <FormFieldRHF
                        key={field.key}
                        label={field.label}
                        fieldKey={field.fieldKey}
                        fieldType={field.type}
                        options={field.options}
                        inputProps={field.type === 'input' ? field.inputProps : undefined}
                        fieldValue={getPrimitiveFieldValue(debugConfig[field.key])}
                        onFieldChange={handleFieldChange}
                        variant='canvas'
                    />
                ))}
            </Container>

            <Container className='f-shrink-0 debug-arguments-panel-footer'>
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
            </Container>
        </Container>
    );
};

export default DebugArgumentsPanel;
