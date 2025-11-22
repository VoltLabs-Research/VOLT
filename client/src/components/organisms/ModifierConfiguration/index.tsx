import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import FormField from '@/components/molecules/FormField';
import EditorWidget from '@/components/organisms/EditorWidget';
import Button from '@/components/atoms/Button';
import usePluginStore from '@/stores/plugins';
import { api } from '@/api';
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
    const hasAutoStarted = useRef(false);
    const hasInitializedPreset = useRef(false);
    const configRef = useRef<Record<string, any>>({});
    const getAvailableArguments = usePluginStore((state) => state.getAvailableArguments);
    const manifests = usePluginStore((state) => state.manifests);

    // Mantener configRef sincronizado con config
    useEffect(() => {
        configRef.current = config;
    }, [config]);

    const availableArguments = useMemo(() => {
        return getAvailableArguments(pluginId, modifierId);
    }, [pluginId, modifierId, getAvailableArguments]);

    const modifierInfo = useMemo(() => {
        const manifest = manifests[pluginId];
        if (!manifest) return null;
        const modifier = manifest.modifiers?.[modifierId];
        if (!modifier) return null;
        const exposure = modifier.exposure[modifierId];
        return {
            displayName: exposure?.displayName || modifierId,
            icon: exposure?.icon,
            preset: modifier.preset || {}
        };
    }, [manifests, pluginId, modifierId]);

    const configFields = useMemo(() => {
        return Object.entries(availableArguments).map(([key, argDef]) => {
            const field: any = {
                key,
                label: argDef.label || key,
                fieldKey: key
            };
            switch (argDef.type) {
                case 'select':
                    field.type = 'select';
                    field.options = Object.entries(argDef.values).map(([value, title]) => ({
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

            if (argDef.default !== undefined && config[key] === undefined) {
                setConfig((prev) => ({ ...prev, [key]: argDef.default }));
            }

            field.visibleWhen = argDef.visibleWhen;
            return field;
        });
    }, [availableArguments, config]);

    const visibleFields = useMemo(() => {
        return configFields.filter((field) => {
            if (!field.visibleWhen) return true;
            return Object.entries(field.visibleWhen).every(([key, expectedValue]) => {
                // Si la clave es "modifier", comparar contra el modifierId actual
                if (key === 'modifier') {
                    // Si expectedValue es un array, verificar si modifierId está incluido
                    if (Array.isArray(expectedValue)) {
                        return expectedValue.includes(modifierId);
                    }
                    return modifierId === expectedValue;
                }
                // De lo contrario, comparar contra los valores de config
                // También soportar arrays para otras propiedades
                if (Array.isArray(expectedValue)) {
                    return expectedValue.includes(config[key]);
                }
                return config[key] === expectedValue;
            });
        });
    }, [configFields, config, modifierId]);

    // Inicializar config con presets al montar (solo una vez)
    useEffect(() => {
        if (!hasInitializedPreset.current && modifierInfo?.preset) {
            const preset = modifierInfo.preset;
            if (Object.keys(preset).length > 0) {
                setConfig((prev) => ({ ...preset, ...prev }));
            }
            hasInitializedPreset.current = true;
        }
    }, [modifierInfo]);

    const handleFieldChange = (key: string, value: any) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
    };

    const startAnalysis = useCallback(async () => {
        setIsLoading(true);
        onAnalysisStart?.();
        try {
            // Construir config final aplicando el orden de prioridad:
            // 1. Preset del modifier (valores base fijos del modifier)
            // 2. Config del usuario (sobrescribe todo lo que el usuario pueda ver/cambiar)
            const preset = modifierInfo?.preset || {};
            const finalConfig = {
                ...preset,  // Valores fijos del preset
                ...config   // Valores configurados por el usuario
            };

            const response = await api.post(
                `/plugins/${pluginId}/modifier/${modifierId}/trajectory/${trajectoryId}`,
                { config: finalConfig }
            );
            const analysisId = response.data?.data?.analysisId;
            onAnalysisSuccess?.(analysisId);
        } catch (error) {
            console.error('Analysis failed:', error);
            onAnalysisError?.(error);
        } finally {
            setIsLoading(false);
        }
    }, [pluginId, modifierId, trajectoryId, config, modifierInfo, onAnalysisStart, onAnalysisSuccess, onAnalysisError]);

    const displayTitle = title || modifierInfo?.displayName || 'Analysis Configuration';

    // Auto-ejecutar el análisis si no hay campos visibles y no se ha ejecutado aún
    useEffect(() => {
        // Solo ejecutar si:
        // 1. No se ha ejecutado aún
        // 2. No está cargando
        // 3. No hay campos visibles
        // 4. Hay un trajectoryId
        // 5. El preset ya se inicializó O no hay preset
        const hasPreset = modifierInfo?.preset && Object.keys(modifierInfo.preset).length > 0;
        const presetReady = !hasPreset || hasInitializedPreset.current;

        if (!hasAutoStarted.current && !isLoading && visibleFields.length === 0 && trajectoryId && presetReady) {
            hasAutoStarted.current = true;

            (async () => {
                setIsLoading(true);
                onAnalysisStart?.();
                try {
                    const preset = modifierInfo?.preset || {};
                    // Usar configRef.current para obtener el valor más reciente del config
                    const finalConfig = {
                        ...preset,
                        ...configRef.current
                    };

                    const response = await api.post(
                        `/plugins/${pluginId}/modifier/${modifierId}/trajectory/${trajectoryId}`,
                        { config: finalConfig }
                    );
                    const analysisId = response.data?.data?.analysisId;
                    onAnalysisSuccess?.(analysisId);
                } catch (error) {
                    console.error('Analysis failed:', error);
                    onAnalysisError?.(error);
                } finally {
                    setIsLoading(false);
                }
            })();
        }
    }, [visibleFields.length, isLoading, trajectoryId, modifierInfo, pluginId, modifierId, onAnalysisStart, onAnalysisSuccess, onAnalysisError]);

    // Si no hay parámetros configurables y ya se ejecutó, no renderizar nada
    if (visibleFields.length === 0 && hasAutoStarted.current) {
        return null;
    }

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