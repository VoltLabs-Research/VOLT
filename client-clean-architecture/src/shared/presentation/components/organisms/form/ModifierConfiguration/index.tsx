import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import FormField from '@/shared/presentation/components/molecules/form/FormField';
import EditorWidget from '@/modules/canvas/presentation/components/organisms/EditorWidget';
import Button from '@/shared/presentation/components/primitives/Button';
import { usePlugin, useExecutePlugin } from '@/modules/plugins/presentation/hooks/use-plugin-queries';
import { trajectoryRepository } from '@/modules/trajectory/infrastructure/repositories/TrajectoryRepository';
import { useQuery } from '@tanstack/react-query';
import Container from '@/shared/presentation/components/primitives/Container';
import '@/shared/presentation/components/organisms/form/ModifierConfiguration/ModifierConfiguration.css';
import Title from '@/shared/presentation/components/primitives/Title';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import useToast from '@/shared/presentation/hooks/ui/use-toast';

interface ModifierConfigurationProps {
    pluginId: string;
    modifierId: string;
    trajectoryId: string;
    title?: string;
    icon?: React.ReactNode;
    className?: string;
    onAnalysisStart?: () => void;
    onAnalysisSuccess?: (analysisId: string) => void;
    onAnalysisError?: (error: any) => void;
    currentTimestep?: number;
};

const ModifierConfiguration = ({
    pluginId,
    modifierId,
    trajectoryId,
    title,
    icon = <IoIosArrowDown />,
    className = '',
    onAnalysisStart,
    onAnalysisSuccess,
    onAnalysisError,
    currentTimestep
}: ModifierConfigurationProps) => {
    const [config, setConfig] = useState<Record<string, any>>({});
    const [selectedFrameOnly, setSelectedFrameOnly] = useState(false);
    const hasAutoStarted = useRef(false);
    const configRef = useRef<Record<string, any>>({});
    const { showSuccess } = useToast();

    const { data: plugin } = usePlugin(modifierId);
    const executePluginMutation = useExecutePlugin();

    const { data: trajectory } = useQuery({
        queryKey: ['trajectories', 'detail', trajectoryId],
        queryFn: () => trajectoryRepository.getById(trajectoryId),
        enabled: Boolean(trajectoryId)
    });

    useEffect(() => {
        configRef.current = config;
    }, [config]);

    const availableArguments = useMemo(() => {
        return plugin?.arguments || [];
    }, [plugin]);

    // Use backend-computed modifier instead of workflow traversal
    const modifierInfo = useMemo(() => {
        if (!plugin?.modifier) return null;

        return {
            displayName: plugin.modifier.name || modifierId,
            icon: plugin.modifier.icon
        };
    }, [plugin, modifierId]);

    useEffect(() => {
        const newConfig = { ...config };
        let hasChanges = false;

        availableArguments.forEach((argDef: any) => {
            const key = argDef.argument;
            const defaultValue = argDef.value ?? argDef.default;

            if (defaultValue !== undefined && newConfig[key] === undefined) {
                newConfig[key] = defaultValue;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            setConfig(newConfig);
        }
    }, [availableArguments]);

    const configFields = useMemo(() => {
        return availableArguments
            .filter((argDef: any) => argDef.value === undefined)
            .map((argDef: any) => {
                const key = argDef.argument;
                const field: any = {
                    key,
                    label: argDef.label || key,
                    fieldKey: key
                };

                switch (argDef.type) {
                    case 'select':
                        field.type = 'select';
                        field.options = (argDef.options || []).map((opt: any) => ({
                            value: opt.key,
                            title: opt.label
                        }));
                        field.selectProps = { renderInPortal: true };
                        break;

                    case 'frame':
                        field.type = 'select';
                        field.options = (trajectory?.frames || []).map((frame: any, index: number) => ({
                            value: String(frame.timestep),
                            title: `Frame ${index + 1} (Timestep ${frame.timestep})`
                        }));
                        if (field.options.length === 0) {
                            field.options = [{ value: '0', title: 'Default (First Frame)' }];
                        }
                        field.selectProps = { renderInPortal: true };
                        break;

                    case 'number':
                        field.type = 'number';
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
    }, [availableArguments, config, trajectory]);

    const handleFieldChange = (key: string, value: any) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
    };

    const startAnalysis = useCallback(async () => {
        onAnalysisStart?.();
        try {
            const analysisId = await executePluginMutation.mutateAsync({
                slug: modifierId,
                trajectoryId,
                config,
                selectedFrameOnly,
                timestep: selectedFrameOnly ? currentTimestep : undefined
            });
            onAnalysisSuccess?.(analysisId);
            showSuccess('The analyses have been successfully queued. Be patient.');
        } catch (error) {
            console.error('Analysis failed:', error);
            onAnalysisError?.(error);
        }
    }, [modifierId, trajectoryId, config, selectedFrameOnly, currentTimestep, onAnalysisStart, onAnalysisSuccess, onAnalysisError, executePluginMutation, showSuccess]);

    const displayTitle = title || modifierInfo?.displayName || 'Analysis Configuration';
    const isLoading = executePluginMutation.isPending;

    // if config.length === 0 then handle auto start
    useEffect(() => {
        if (!hasAutoStarted.current && !isLoading && availableArguments.length === 0 && trajectoryId && plugin) {
            hasAutoStarted.current = true;
            startAnalysis();
        }
    }, [availableArguments.length, isLoading, trajectoryId, plugin, startAnalysis]);

    if (configFields.length === 0 && hasAutoStarted.current) {
        return null;
    }

    return (
        <EditorWidget className={`modifier-configuration d-flex column ${className}`} draggable={false}>
            <Container className='d-flex content-between items-center'>
                <Title className='font-weight-5-5'>{displayTitle}</Title>
                {icon}
            </Container>

            <Container className='d-flex column gap-1 modifier-configuration-body-container y-scroll'>
                {configFields.length === 0 ? (
                    <Paragraph className='color-muted font-size-2 text-center no-fields-text'>
                        This modifier has no configurable parameters.
                    </Paragraph>
                ) : (
                    configFields.map((field: any) => (
                        <FormField
                            key={field.key}
                            label={field.label}
                            fieldKey={field.fieldKey}
                            fieldType={field.type}
                            options={field.options}
                            inputProps={field.type === 'input' ? field.inputProps : undefined}
                            fieldValue={config[field.key]}
                            onFieldChange={handleFieldChange}
                            {...(field.type === 'select' ? field.selectProps : {})}
                        />
                    ))
                )}

                <FormField
                    label='Selected frame only'
                    fieldKey='selectedFrameOnly'
                    fieldType='checkbox'
                    fieldValue={selectedFrameOnly}
                    onFieldChange={(_: string, value: any) => setSelectedFrameOnly(value)}
                />
            </Container>

            <Container className='d-flex column gap-1'>
                <Button
                    className='start-analysis-btn'
                    isLoading={isLoading}
                    variant='outline'
                    intent='white'
                    block
                    onClick={startAnalysis}
                    disabled={isLoading}
                >
                    Start Analysis
                </Button>
            </Container>
        </EditorWidget>
    );
};

export default ModifierConfiguration;
