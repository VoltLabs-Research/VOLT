import React, { useMemo, useState, useEffect } from 'react';
import Input from '@/shared/presentation/components/atoms/form/Input';
import Select, { type SelectOption } from '@/shared/presentation/components/atoms/form/Select';
import IconSelect from '@/shared/presentation/components/molecules/form/IconSelect';
import LiquidToggle from '@/shared/presentation/components/atoms/form/LiquidToggle';
import { getAvailableExpressions, type NodeOutputSchema } from '@/modules/plugins/presentation/utilities/expression-utils';
import { NODE_CONFIGS } from '@/modules/plugins/presentation/utilities/node-types';
import { NodeType } from '@/modules/plugins/domain/entities';
import { useNodeSchemas } from '@/modules/plugins/presentation/hooks/use-plugin-queries';
import Container from '@/shared/presentation/components/primitives/Container';
import Title from '@/shared/presentation/components/primitives/Title';
import { usePluginBuilderStore } from '@/modules/plugins/presentation/stores/builder-slice';
import '@/shared/presentation/components/molecules/form/FormField/FormField.css';

interface FormFieldProps {
    label: string;
    fieldKey: string;
    fieldType: 'input' | 'select' | 'checkbox' | 'color' | 'iconSelect';
    fieldValue: string | number | boolean;
    onFieldChange: (key: string, value: any) => void;
    inputProps?: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
        type?: 'text' | 'number' | 'email' | 'password';
    };
    options?: SelectOption[];
    isLoading?: boolean;
    renderInPortal?: boolean;
    expressionEnabled?: boolean;
    expressionNodeId?: string;
    expressionMultiline?: boolean;
    expressionRows?: number;
}

const selectNodes = (state: any) => state.nodes;
const selectEdges = (state: any) => state.edges;
const emptyArray: never[] = [];
const selectEmpty = () => emptyArray;

const FormField: React.FC<FormFieldProps> = ({
    label,
    fieldKey,
    fieldType,
    fieldValue,
    onFieldChange,
    inputProps,
    options,
    isLoading = false,
    renderInPortal = false,
    expressionEnabled = false,
    expressionNodeId,
    expressionMultiline = false,
    expressionRows = 3
}) => {
    const nodes = usePluginBuilderStore(expressionEnabled ? selectNodes : selectEmpty);
    const edges = usePluginBuilderStore(expressionEnabled ? selectEdges : selectEmpty);
    const { data: schemas } = useNodeSchemas(expressionEnabled);

    const handleChange = (value: string | number | boolean) => {
        onFieldChange(fieldKey, value);
    };

    // Create expression autocomplete config if enabled
    const expressionAutocomplete = useMemo(() => {
        if (!expressionEnabled || !expressionNodeId) return undefined;

        return {
            nodeId: expressionNodeId,
            getExpressions: (nodeId: string) => getAvailableExpressions(nodeId, nodes, edges),
            getNodeConfig: (nodeType: string) => NODE_CONFIGS[nodeType as keyof typeof NODE_CONFIGS] || null
        };
    }, [expressionEnabled, expressionNodeId, nodes, edges]);

    const renderInput = () => {
        switch (fieldType) {
            case 'select':
                return (
                    <Select
                        options={options || []}
                        value={String(fieldValue)}
                        onChange={handleChange}
                        className='labeled-input'
                    />
                );

            case 'checkbox':
                return (
                    <LiquidToggle
                        pressed={Boolean(fieldValue)}
                        onChange={(next) => onFieldChange(fieldKey, next)}
                    />
                );

            case 'color':
                return (
                    <input
                        type="color"
                        value={typeof fieldValue === 'string' ? fieldValue : String(fieldValue)}
                        onChange={(e) => handleChange(e.target.value)}
                        className='labeled-input-color'
                        {...inputProps}
                    />
                );

            case 'iconSelect':
                return (
                    <IconSelect
                        value={String(fieldValue)}
                        onChange={handleChange}
                        renderInPortal={renderInPortal}
                    />
                );

            case 'input':
            default:
                return (
                    <Input
                        {...inputProps}
                        value={String(fieldValue)}
                        onChange={handleChange}
                        className='labeled-input'
                        multiline={expressionMultiline}
                        rows={expressionRows}
                        expressionAutocomplete={expressionAutocomplete}
                    />
                );
        }
    };

    return (
        <Container className={`d-flex content-between items-center ${fieldType === 'checkbox' ? 'checkbox-container' : ''} ${isLoading ? 'form-field-loading' : ''}`}>
            <Title className='font-size-2-5 labeled-input-label font-weight-4'>{label}</Title>
            <Container className='d-flex items-center render-input-container'>
                {renderInput()}
            </Container>
        </Container>
    );
};

export default FormField;
