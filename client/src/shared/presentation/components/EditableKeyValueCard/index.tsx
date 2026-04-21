import { showPromise } from '@/shared/presentation/hooks/toast';
import Button from '@/shared/presentation/components/Button';
import './EditableKeyValueCard.css';
import { Plus, Trash2, Settings } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

export interface FieldConfig {
    key: string;
    placeholder: string;
    type?: 'text' | 'number';
    label?: string;
};

export interface EditableKeyValueCardProps<T extends Record<string, unknown>> {
    title?: string;
    items: T[];
    fields: FieldConfig[];
    emptyMessage?: string;
    onSave?: (items: T[]) => Promise<void>;
    onChange?: (items: T[]) => void;
    createEmpty: () => T;
    renderItem?: (item: T, index: number) => React.ReactNode;
    alwaysEditing?: boolean;
    showCard?: boolean;
    addButtonPosition?: 'top' | 'bottom';
    className?: string;
};

const EditableKeyValueCard = <T extends Record<string, unknown>>({
    title,
    items,
    fields,
    emptyMessage = 'No items',
    onSave,
    onChange,
    createEmpty,
    renderItem,
    alwaysEditing = false,
    showCard = true,
    addButtonPosition = 'bottom',
    className = 'd-flex gap-075 column'
}: EditableKeyValueCardProps<T>) => {
    const [editing, setEditing] = useState(alwaysEditing);
    const [localItems, setLocalItems] = useState<T[]>(items);
    const headingId = useId();
    const statusId = useId();

    useEffect(() => {
        if (alwaysEditing) {
            setLocalItems(items);
        }
    }, [items, alwaysEditing]);

    const handleEdit = () => {
        setLocalItems([...items]);
        setEditing(true);
    };

    const handleCancel = () => {
        setLocalItems([...items]);
        setEditing(false);
    };

    const handleSave = async () => {
        if (onSave) {
            await showPromise(
                () => onSave(localItems),
                {
                    loading: { title: 'Saving changes...' },
                    success: { title: 'Changes saved' },
                    error: { title: 'Failed to save changes' }
                }
            );
        }
        setEditing(false);
    };

    const handleChange = (index: number, field: string, value: string | number) => {
        const updated = [...localItems];
        updated[index] = { ...updated[index], [field]: value };
        setLocalItems(updated);
        
        if (alwaysEditing && onChange) {
            onChange(updated);
        }
    };

    const handleRemove = (index: number) => {
        const updated = localItems.filter((_, i) => i !== index);
        setLocalItems(updated);
        
        if (alwaysEditing && onChange) {
            onChange(updated);
        }
    };

    const handleAdd = () => {
        const updated = [...localItems, createEmpty()];
        setLocalItems(updated);
        
        if (alwaysEditing && onChange) {
            onChange(updated);
        }
    };

    const isEditing = alwaysEditing || editing;
    const showHeader = title || (!alwaysEditing && onSave) || (alwaysEditing && addButtonPosition === 'top');
    const showLabels = fields.some(f => f.label);
    const stateLabel = isEditing
        ? `Editing ${localItems.length} item${localItems.length === 1 ? '' : 's'}.`
        : `${items.length} item${items.length === 1 ? '' : 's'} available.`;

    const content = (
        <>
            <span id={statusId} className='editable-kv-live-region' aria-live='polite' aria-atomic='true'>
                {stateLabel}
            </span>
            {showHeader && (
                <div className='volt-container d-flex content-between items-center mb-1'>
                    {title && <h3 id={headingId} className='volt-title font-size-3 font-weight-6'>{title}</h3>}
                    <div className='volt-container d-flex gap-05'>
                        {alwaysEditing && addButtonPosition === 'top' && (
                            <Button variant='ghost' intent='neutral' size='sm' leftIcon={<Plus size={14} />} onClick={handleAdd}>
                                Add
                            </Button>
                        )}
                        {!alwaysEditing && onSave && (
                            editing ? (
                                <>
                                    <Button variant='solid' intent='brand' size='sm' onClick={handleSave}>Save</Button>
                                    <Button variant='ghost' intent='neutral' size='sm' onClick={handleCancel}>Cancel</Button>
                                </>
                            ) : (
                                <Button variant='ghost' intent='neutral' size='sm' iconOnly aria-label='Edit items' title='Edit items' onClick={handleEdit}>
                                    <Settings size={16} />
                                </Button>
                            )
                        )}
                    </div>
                </div>
            )}

            <div className='volt-container d-flex column gap-075'>
                {isEditing ? (
                    <>
                        {localItems.map((item, i) => (
                            <div key={i} className='volt-container editable-kv-row d-flex items-center gap-075'>
                                {fields.map((field) => (
                                    <div key={field.key} className='volt-container editable-kv-field'>
                                        {showLabels && field.label && (
                                            <label className='font-size-1 color-muted' htmlFor={`editable-kv-${field.key}-${i}`}>{field.label}</label>
                                        )}
                                        <input
                                            id={`editable-kv-${field.key}-${i}`}
                                            type={field.type || 'text'}
                                            placeholder={field.placeholder}
                                            aria-label={field.label ?? field.placeholder}
                                            value={String(item[field.key] ?? '')}
                                            className='editable-kv-input font-size-2'
                                            onChange={(e) => handleChange(
                                                i,
                                                field.key,
                                                field.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value
                                            )}
                                        />
                                    </div>
                                ))}
                                <Button variant='ghost' intent='danger' size='sm' iconOnly aria-label={`Remove item ${i + 1}`} title={`Remove item ${i + 1}`} onClick={() => handleRemove(i)}>
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        ))}
                        {localItems.length === 0 && (
                            <p className='volt-text color-muted font-size-2 text-center p-1'>{emptyMessage}</p>
                        )}
                        {addButtonPosition === 'bottom' && (
                            <Button 
                                variant='ghost' 
                                intent='neutral' 
                                size='sm' 
                                block 
                                leftIcon={<Plus size={16} />}
                                className='editable-kv-add-btn'
                                onClick={handleAdd}
                            >
                                Add
                            </Button>
                        )}
                    </>
                ) : (
                    <>
                        {items.length > 0 ? (
                            renderItem ? items.map((item, i) => renderItem(item, i)) : (
                                items.map((item, i) => (
                                    <div key={i} className='volt-container editable-kv-display-row d-flex gap-1'>
                                        {fields.map((field) => (
                                            <span key={field.key} className='color-secondary'>
                                                {String(item[field.key] ?? '')}
                                            </span>
                                        ))}
                                    </div>
                                ))
                            )
                        ) : (
                            <p className='volt-text color-muted font-size-2'>{emptyMessage}</p>
                        )}
                    </>
                )}
            </div>
        </>
    );

    if (!showCard) {
        return <div className={`volt-container ${className}`} aria-labelledby={title ? headingId : undefined}>{content}</div>;
    }

    return (
        <div className={`volt-container editable-kv-card p-1-5 ${className}`} aria-labelledby={title ? headingId : undefined}>
            {content}
        </div>
    );
};

export default EditableKeyValueCard;
