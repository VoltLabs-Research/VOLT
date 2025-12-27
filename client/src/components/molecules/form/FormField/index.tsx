import React, { useMemo, useState, useEffect } from 'react';
import Input from '@/components/atoms/form/Input';
import Select, { type SelectOption } from '@/components/atoms/form/Select';
import IconSelect from '@/components/molecules/form/IconSelect';
import LiquidToggle from '@/components/atoms/form/LiquidToggle';
import usePluginBuilderStore from '@/stores/plugins/plugin-builder';
import { getAvailableExpressions, type NodeOutputSchema } from '@/utilities/plugins/expression-utils';
import { NODE_CONFIGS } from '@/utilities/plugins/node-types';
import { NodeType } from '@/types/plugin';
import pluginApi from '@/services/api/plugin';
import './FormField.css';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';

interface FormFieldProps {
    label: string;
    fieldKey: string;
    fieldType: 'input' | 'select' | 'checkbox' | 'color' | 'iconSelect';
    fieldValue: string | number | boolean;
    onFieldChange: (key: string, value: any) => void;
    inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
    options?: SelectOption[];
    isLoading?: boolean;
    renderInPortal?: boolean;
    expressionEnabled?: boolean;
    expressionNodeId?: string;
    expressionMultiline?: boolean;
    expressionRows?: number;
}

let schemasCache: Record<NodeType, NodeOutputSchema> | null = null;

const selectNodes = (state: ReturnType<typeof usePluginBuilderStore.getState>) => state.nodes;
const selectEdges = (state: ReturnType<typeof usePluginBuilderStore.getState>) => state.edges;
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
    const [schemas, setSchemas] = useState<Record<NodeType, NodeOutputSchema> | null>(schemasCache);

    useEffect(() => {
        if (schemasCache || !expressionEnabled) return;

        pluginApi.getNodeSchemas().then(data => {
            schemasCache = data as Record<NodeType, NodeOutputSchema>;
            setSchemas(data as Record<NodeType, NodeOutputSchema>);
        }).catch(() => {
            schemasCache = {} as Record<NodeType, NodeOutputSchema>;
            setSchemas({} as Record<NodeType, NodeOutputSchema>);
        });
    }, [expressionEnabled]);

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
