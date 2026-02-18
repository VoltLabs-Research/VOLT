import { useMemo, useEffect, useCallback } from 'react';
import { usePluginDebugStore } from '@/modules/plugin/presentation/stores/use-plugin-debug-store';
import { usePluginBuilderStore } from '@/modules/plugin/presentation/stores/use-plugin-builder-store';
import useDebugTrajectorySelector from '@/modules/plugin/presentation/hooks/use-debug-trajectory-selector';
import { NodeType } from '@/modules/plugin/domain/entities';
import type { IArgumentDefinition } from '@/modules/plugin/domain/entities/Workflow';
import FormField from '@/shared/presentation/components/FormField';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import IconButton from '@/shared/presentation/components/IconButton';
import { X, Play, Settings2 } from 'lucide-react';
import './DebugArgumentsPanel.css';

interface DebugArgumentsPanelProps {
    onStart: () => void;
    canStart: boolean;
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

        const argsDef = (argsNode.data as any)?.arguments?.arguments as IArgumentDefinition[] | undefined;
        if (!argsDef) return [];

        // Filter to only arguments without a hardcoded `value` — those are user-configurable
        return argsDef.filter((arg) => arg.value === undefined);
    }, [nodes]);

    // Pre-fill config with defaults when configurable args change
    useEffect(() => {
        if (configurableArgs.length === 0) return;

        const newConfig: Record<string, any> = { ...debugConfig };
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
    }, [configurableArgs]);

    const handleFieldChange = useCallback((key: string, value: any) => {
        setDebugConfigField(key, value);
    }, [setDebugConfigField]);

    const handleStartClick = useCallback(() => {
        setShowArgumentsPanel(false);
        onStart();
    }, [onStart, setShowArgumentsPanel]);

    const handleClose = useCallback(() => {
        setShowArgumentsPanel(false);
    }, [setShowArgumentsPanel]);

    // Build form fields (same logic as ModifierConfiguration)
    const configFields = useMemo(() => {
        return configurableArgs.map((argDef) => {
            const key = argDef.argument;
            const field: any = {
                key,
                label: argDef.label || key,
                fieldKey: key
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
                    field.options = (selectedTrajectory?.frames || []).map((frame: any, index: number) => ({
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

    // If no configurable arguments exist, don't render
    if (configurableArgs.length === 0) return null;

    // If panel is hidden, don't render
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
                    <FormField
                        key={field.key}
                        label={field.label}
                        fieldKey={field.fieldKey}
                        fieldType={field.type}
                        options={field.options}
                        inputProps={field.type === 'input' ? field.inputProps : undefined}
                        fieldValue={debugConfig[field.key] ?? ''}
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
