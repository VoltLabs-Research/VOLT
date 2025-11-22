import React from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import FormField from '@/components/molecules/FormField';
import EditorWidget from '@/components/organisms/EditorWidget';
import Button from '@/components/atoms/Button';
import usePluginStore from '@/stores/plugins';
import { api } from '@/api';
import { useMemo, useState } from 'react';
import './ModifierConfiguration.css';

interface ModifierConfigurationProps{
    pluginId: string;
    modifierId: string;
    trajectoryId: string;
    title?: string;
    icon?: React.ReactNode;
    className?: string;
    onAnalysisStart?: () => void;
    onAnalysisSuccess?: (analysisId: string) => void;
    onAnalysisError?: (error: any) => void;
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
    onAnalysisError
}: ModifierConfigurationProps) => {
    const [config, setConfig] = useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = useState(false);
    const getAvailableArguments = usePluginStore((state) => state.getAvailableArguments);
    const manifests = usePluginStore((state) => state.manifests);

    const availableArguments = useMemo(() => {
        return getAvailableArguments(pluginId, modifierId);
    }, [pluginId, modifierId, getAvailableArguments]);

    const modifierInfo = useMemo(() => {
        const manifest = manifests[pluginId];
        if(!manifest) return null;
        const modifier = manifest.modifiers?.[modifierId];
        if(!modifier) return null;
        const exposure = modifier.exposure[modifierId];
        return {
            displayName: exposure?.displayName || modifierId,
            icon: exposure?.icon
        };
    }, [manifests, pluginId, modifierId]);

    const configFields = useMemo(() => {
        return Object.entries(availableArguments).map(([ key, argDef ]) => {
            const field: any = {
                key,
                label: argDef.label || key,
                fieldKey: key
            };
            switch(argDef.type){
                case 'select':
                    field.type = 'select';
                    field.options = Object.entries(argDef.values).map(([ value, title ]) => ({
                        value,
                        title
                    })),
                    field.selectProps = { renderInPortal: true };
                    break;
                
                case 'number':
                    field.type = 'number';
                    field.inputProps = {
                        type: 'number',
                        ste: argDef.step || 0.1,
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

            if(argDef.default !== undefined && config[key] === undefined){
                setConfig((prev) => ({ ...prev, [key]: argDef.default }));
            }

            field.visibleWhen = argDef.visibleWhen;
            return field;
        });
    }, [availableArguments, config]);

    const visibleFields = useMemo(() => {
        return configFields.filter((field) => {
            if(!field.visibleWhen) return true;
            return Object.entries(field.visibleWhen).every(([ key, expectedValue ]) => {
                return config[key] === expectedValue;
            });
        });
    }, [configFields, config]);

    const handleFieldChange = (key: string, value: any) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
    };

    const startAnalysis = async () => {
        setIsLoading(true);
        onAnalysisStart?.();
        try{
            const response = await api.post(
                `/plugins/${pluginId}/modifier/${modifierId}/trajectory/${trajectoryId}`,
                { config }
            );
            const analysisId = response.data?.data?.analysisId;
            onAnalysisSuccess?.(analysisId);
        }catch(error){
            console.error('Analysis failed:', error);
            onAnalysisError?.(error);
        }finally{
            setIsLoading(false);
        }
    };

    const displayTitle = title || modifierInfo?.displayName || 'Analysis Configuration';

    return (
        <EditorWidget className={`modifier-configuration ${className}`} draggable={false}>
            <div className='modifier-configuration-header-container'>
                <h3 className='modifier-configuration-header-title'>{displayTitle}</h3>
                {icon}    
            </div>

            <div className='modifier-configuration-body-container'>
                {visibleFields.length === 0 ? (
                    <p className='modifier-configuration-no-fields'>
                        This modifier has no configurable parameters.
                    </p>
                ) : (
                    visibleFields.map((field) => (
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