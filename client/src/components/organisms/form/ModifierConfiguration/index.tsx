import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import FormField from '@/components/molecules/form/FormField';
import EditorWidget from '@/components/organisms/scene/EditorWidget';
import Button from '@/components/atoms/common/Button';
import usePluginStore from '@/stores/plugins/plugin';
import useTrajectoryStore from '@/stores/trajectories';
import pluginApi from '@/services/api/plugin';
import './ModifierConfiguration.css';

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
    const [isLoading, setIsLoading] = useState(false);
    const hasAutoStarted = useRef(false);
    const [hasInitializedPreset, setHasInitializedPreset] = useState(false);
    const configRef = useRef<Record<string, any>>({});
    const getAvailableArguments = usePluginStore((state) => state.getPluginArguments);
    const plugins = usePluginStore((state) => state.plugins);

    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const fetchTrajectory = useTrajectoryStore((state) => state.getTrajectoryById);

    useEffect(() => {
        if(trajectoryId && (!trajectory || trajectory._id !== trajectoryId)) {
            fetchTrajectory(trajectoryId);
        }
    }, [trajectoryId, trajectory, fetchTrajectory]);

    useEffect(() => {
        configRef.current = config;
    }, [config]);

    const availableArguments = useMemo(() => {
        return getAvailableArguments(modifierId);  // Use modifierId(slug) instead of pluginId(_id)
    }, [modifierId, getAvailableArguments]);

    const modifierInfo = useMemo(() => {
        const plugin = plugins.find((plugin) => plugin.slug === modifierId);  // Use modifierId(slug)
        if(!plugin) return null;

        const modifierNode = plugin.workflow.nodes.find((node: any) => node.type === 'modifier');
        const modifierData = modifierNode?.data?.modifier || {};

        return {
            displayName: modifierData.name || modifierId,
            icon: modifierData.icon
        };
    }, [plugins, modifierId]);

    const configFields = useMemo(() => {
        return availableArguments.map((argDef: any) => {
            const key = argDef.argument;
            const field: any = {
                key,
                label: argDef.label || key,
                fieldKey: key
            };

            switch(argDef.type){
                case 'select':
                    field.type = 'select';
                    field.options = (argDef.options || []).map((opt: any) => ({
                        value: opt.key,
                        title: opt.label
                    }));
                    field.selectProps = { renderInPortal: true };
                    break;

                case 'frame':
                    field.options = (trajectory?.frames || []).map((frame: any, index: number) => ({
                        value: String(frame.timestep),
                        title: `Frame ${index + 1} (Time ${frame.timestep})`
                    }));
                    if(field.options.length === 0){
                        field.options = [{ value: '0', title: 'Default(First Frame)' }];
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

            const defaultValue = argDef.default ?? argDef.value;
            if(defaultValue !== undefined && config[key] === undefined){
                setConfig((prev) => ({ ...prev, [key]: defaultValue }));
            }

            return field;
        });
    }, [availableArguments, config, trajectory]);

    const handleFieldChange = (key: string, value: any) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
    };

    const startAnalysis = useCallback(async() => {
        setIsLoading(true);
        onAnalysisStart?.();
        try{
            const response = await pluginApi.executeModifier(
                modifierId,
                modifierId,
                trajectoryId,
                { config, timestep: currentTimestep }
            );
            const analysisId = (response as any)?.analysisId;
            onAnalysisSuccess?.(analysisId);
        }catch(error){
            console.error('Analysis failed:', error);
            onAnalysisError?.(error);
        }finally{
            setIsLoading(false);
        }
    }, [modifierId, trajectoryId, config, modifierInfo, onAnalysisStart, onAnalysisSuccess, onAnalysisError, currentTimestep]);

    const displayTitle = title || modifierInfo?.displayName || 'Analysis Configuration';

    // if config.length === 0 then handle auto start
    useEffect(() => {
        if(!hasAutoStarted.current && !isLoading && config.length === 0 && trajectoryId){
            hasAutoStarted.current = true;
            // TODO: another function for this
            (async() => {
                setIsLoading(true);
                onAnalysisStart?.();
                try{
                    const response = await pluginApi.executeModifier(
                        modifierId,
                        modifierId,
                        trajectoryId,
                        { config: configRef.current, timestep: currentTimestep }
                    );
                    const analysisId = (response as any)?.analysisId;
                    onAnalysisSuccess?.(analysisId);
                }catch(error){
                    console.error('Analysis failed:', error);
                    onAnalysisError?.(error);
                }finally{
                    setIsLoading(false);
                }
            })();
        }
    }, [configFields.length, isLoading, trajectoryId, modifierInfo, modifierId, onAnalysisStart, onAnalysisSuccess, onAnalysisError]);

    if(configFields.length === 0 && hasAutoStarted.current){
        return null;
    }

    return (
        <EditorWidget className={`modifier-configuration ${className}`} draggable={false}>
            <div className='modifier-configuration-header-container'>
                <h3 className='modifier-configuration-header-title'>{displayTitle}</h3>
                {icon}
            </div>

            <div className='modifier-configuration-body-container'>
                {configFields.length === 0 ? (
                    <p className='modifier-configuration-no-fields'>
                        This modifier has no configurable parameters.
                    </p>
                ) : (
                    configFields.map((field) => (
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
            </div>

            <div className='modifier-configuration-footer-container'>
                <Button
                    isLoading={isLoading}
                    className='smooth click-scale start-analysis-btn'
                    title='Start Analysis'
                    onClick={startAnalysis}
                    disabled={isLoading}
                />
            </div>
        </EditorWidget>
    );
};

export default ModifierConfiguration;
