import React from 'react';
import FormField from '@/components/molecules/form/FormField';
import { TbPlus, TbTrash } from 'react-icons/tb';
import './KeyValueEditor.css';
import Container from '@/components/primitives/Container';
import Paragraph from '@/components/primitives/Paragraph';

interface KeyValueEditorProps {
    entries: [string, string][];
    onAdd: () => void;
    onRemove: (key: string) => void;
    onKeyChange: (oldKey: string, newKey: string) => void;
    onValueChange: (key: string, value: string) => void;
    keyLabel?: string;
    valueLabel?: string;
    keyPlaceholder?: string;
    valuePlaceholder?: string;
    addButtonText?: string;
    description?: string;
    // Expression support
    expressionEnabled?: boolean;
    expressionNodeId?: string;
}

// TODO: REFACTOR
const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
    entries,
    onAdd,
    onRemove,
    onKeyChange,
    onValueChange,
    keyLabel = 'Key',
    valueLabel = 'Value',
    keyPlaceholder = 'key',
    valuePlaceholder = 'value',
    addButtonText = 'Add Item',
    description,
    expressionEnabled = false,
    expressionNodeId
}) => {
    return (
        <Container className="d-flex column gap-05">
            {description && (
                <Paragraph className="kv-editor-description">{description}</Paragraph>
            )}

            {entries.map(([key, value], index) => (
                <Container key={index} className="d-flex gap-05 items-start">
                    <Container className="flex-1 d-flex column">
                        {index === 0 && <label className="kv-editor-label">{keyLabel}</label>}
                        <FormField
                            label=""
                            fieldKey="key"
                            fieldType="input"
                            fieldValue={key}
                            onFieldChange={(_, newKey) => onKeyChange(key, newKey as string)}
                            inputProps={{ placeholder: keyPlaceholder }}
                            expressionEnabled={expressionEnabled}
                            expressionNodeId={expressionNodeId}
                        />
                    </Container>
                    <Container className="flex-1 d-flex column">
                        {index === 0 && <label className="kv-editor-label">{valueLabel}</label>}
                        <FormField
                            label=""
                            fieldKey="value"
                            fieldType="input"
                            fieldValue={value}
                            onFieldChange={(_, val) => onValueChange(key, val as string)}
                            inputProps={{ placeholder: valuePlaceholder }}
                            expressionEnabled={expressionEnabled}
                            expressionNodeId={expressionNodeId}
                        />
                    </Container>
                    <button
                        onClick={() => onRemove(key)}
                        className="kv-editor-remove"
                        style={{ marginTop: index === 0 ? '1.25rem' : 0 }}
                    >
                        <TbTrash size={14} />
                    </button>
                </Container>
            ))}

            <button onClick={onAdd} className="kv-editor-add">
                <TbPlus size={12} />
                {addButtonText}
            </button>
        </Container>
    );
};

export default KeyValueEditor;
