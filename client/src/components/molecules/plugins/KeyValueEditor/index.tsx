import React from 'react';
import FormField from '@/components/molecules/form/FormField';
import { TbPlus, TbTrash } from 'react-icons/tb';
import './KeyValueEditor.css';

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
        <div className="kv-editor">
            {description && (
                <p className="kv-editor-description">{description}</p>
            )}

            {entries.map(([key, value], index) => (
                <div key={index} className="kv-editor-row">
                    <div className="kv-editor-field">
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
                    </div>
                    <div className="kv-editor-field">
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
                    </div>
                    <button
                        onClick={() => onRemove(key)}
                        className="kv-editor-remove"
                        style={{ marginTop: index === 0 ? '1.25rem' : 0 }}
                    >
                        <TbTrash size={14} />
                    </button>
                </div>
            ))}

            <button onClick={onAdd} className="kv-editor-add">
                <TbPlus size={12} />
                {addButtonText}
            </button>
        </div>
    );
};

export default KeyValueEditor;
