import { useState, useEffect } from 'react';
import { Plus, Trash2, Settings } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { showPromise } from '@/shared/presentation/hooks/toast';
import './EditableKeyValueCard.css';

export interface FieldConfig {
    key: string;
    placeholder: string;
    type?: 'text' | 'number';
    label?: string;
}

export interface EditableKeyValueCardProps<T extends Record<string, any>> {
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
}

const EditableKeyValueCard = <T extends Record<string, any>>({
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

    const content = (
        <>
            {showHeader && (
                <Container className='d-flex content-between items-center mb-1'>
                    {title && <Title className='font-size-3 font-weight-6'>{title}</Title>}
                    <Container className='d-flex gap-05'>
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
                                <Button variant='ghost' intent='neutral' size='sm' iconOnly onClick={handleEdit}>
                                    <Settings size={16} />
                                </Button>
                            )
                        )}
                    </Container>
                </Container>
            )}

            <Container className='d-flex column gap-075'>
                {isEditing ? (
                    <>
                        {localItems.map((item, i) => (
                            <Container key={i} className='editable-kv-row d-flex items-center gap-075'>
                                {fields.map((field) => (
                                    <Container key={field.key} className='editable-kv-field'>
                                        {showLabels && field.label && (
                                            <label className='font-size-1 color-muted'>{field.label}</label>
                                        )}
                                        <input
                                            type={field.type || 'text'}
                                            placeholder={field.placeholder}
                                            value={item[field.key] ?? ''}
                                            className='editable-kv-input font-size-2'
                                            onChange={(e) => handleChange(
                                                i,
                                                field.key,
                                                field.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value
                                            )}
                                        />
                                    </Container>
                                ))}
                                <Button variant='ghost' intent='danger' size='sm' iconOnly onClick={() => handleRemove(i)}>
                                    <Trash2 size={16} />
                                </Button>
                            </Container>
                        ))}
                        {localItems.length === 0 && (
                            <Paragraph className='color-muted font-size-2 text-center p-1'>{emptyMessage}</Paragraph>
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
                                    <Container key={i} className='editable-kv-display-row d-flex gap-1'>
                                        {fields.map((field) => (
                                            <span key={field.key} className='color-secondary'>
                                                {String(item[field.key] ?? '')}
                                            </span>
                                        ))}
                                    </Container>
                                ))
                            )
                        ) : (
                            <Paragraph className='color-muted font-size-2'>{emptyMessage}</Paragraph>
                        )}
                    </>
                )}
            </Container>
        </>
    );

    if (!showCard) {
        return <Container className={className}>{content}</Container>;
    }

    return (
        <Container className={`editable-kv-card p-1-5 ${className}`}>
            {content}
        </Container>
    );
};

export default EditableKeyValueCard;
