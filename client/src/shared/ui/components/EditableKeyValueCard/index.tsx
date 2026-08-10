import { Button, Tooltip, cn } from '@heroui/react';
import { showPromise } from '@/shared/ui/hooks/toast';
import { Plus, Trash2, Settings } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

export interface FieldConfig {
    key: string;
    placeholder: string;
    type?: 'text' | 'number';
    label?: string;
};

interface EditableKeyValueCardProps<T extends Record<string, unknown>> {
    title?: string;
    titleClassName?: string;
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

const INPUT_CLASSES = 'w-full rounded-md border border-border bg-background px-3 py-[0.6rem] text-foreground transition-[border-color] duration-200 focus:border-accent';

const EditableKeyValueCard = <T extends Record<string, unknown>>({
    title,
    titleClassName,
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
    className = 'flex gap-3 flex-col'
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
        updated[index] = {
            ...updated[index],
            [field]: value
        };
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
            <span id={statusId} className='sr-only' aria-live='polite' aria-atomic='true'>
                {stateLabel}
            </span>
            {showHeader && (
                <div className='flex flex-row items-center justify-between mb-4'>
                    {title && <h3 className={cn('text-base font-semibold text-foreground', titleClassName)} id={headingId}>{title}</h3>}
                    <div className='flex gap-2'>
                        {alwaysEditing && addButtonPosition === 'top' && (
                            <Button variant='ghost' size='sm' onPress={handleAdd}>
                                <Plus size={14} />
                                Add
                            </Button>
                        )}
                        {!alwaysEditing && onSave && (
                            editing ? (
                                <>
                                    <Button variant='primary' size='sm' onPress={() => { void handleSave(); }}>Save</Button>
                                    <Button variant='ghost' size='sm' onPress={handleCancel}>Cancel</Button>
                                </>
                            ) : (
                                <Tooltip>
                                    <Button variant='ghost' size='sm' isIconOnly aria-label='Edit items' onPress={handleEdit}>
                                        <Settings size={16} />
                                    </Button>
                                    <Tooltip.Content>Edit items</Tooltip.Content>
                                </Tooltip>
                            )
                        )}
                    </div>
                </div>
            )}

            <div className='flex flex-col gap-3'>
                {isEditing ? (
                    <>
                        {localItems.map((item, i) => (
                            <div className='flex flex-row items-center gap-3 animate-in fade-in-0 duration-200 ease-out' key={i}>
                                {fields.map((field) => (
                                    <div key={field.key} className='flex-1'>
                                        {showLabels && field.label && (
                                            <label className='block mb-1 text-xs text-muted' htmlFor={`editable-kv-${field.key}-${i}`}>{field.label}</label>
                                        )}
                                        <input
                                            id={`editable-kv-${field.key}-${i}`}
                                            type={field.type || 'text'}
                                            placeholder={field.placeholder}
                                            aria-label={field.label ?? field.placeholder}
                                            value={String(item[field.key] ?? '')}
                                            className={cn(INPUT_CLASSES, 'text-sm')}
                                            onChange={(e) => handleChange(
                                                i,
                                                field.key,
                                                field.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value
                                            )}
                                        />
                                    </div>
                                ))}
                                <Tooltip>
                                    <Button variant='ghost' size='sm' isIconOnly className='text-danger' aria-label={`Remove item ${i + 1}`} onPress={() => handleRemove(i)}>
                                        <Trash2 size={16} />
                                    </Button>
                                    <Tooltip.Content>{`Remove item ${i + 1}`}</Tooltip.Content>
                                </Tooltip>
                            </div>
                        ))}
                        {localItems.length === 0 && (
                            <p className='text-sm text-muted text-center p-4'>{emptyMessage}</p>
                        )}
                        {addButtonPosition === 'bottom' && (
                            <Button
                                variant='ghost'
                                size='sm'
                                fullWidth
                                className='border border-dashed border-border hover:border-accent'
                                onPress={handleAdd}
                            >
                                <Plus size={16} />
                                Add
                            </Button>
                        )}
                    </>
                ) : (
                    <>
                        {items.length > 0 ? (
                            renderItem ? items.map((item, i) => renderItem(item, i)) : (
                                items.map((item, i) => (
                                    <div className='flex gap-4 p-3.5 rounded-lg bg-surface-tertiary text-sm border border-transparent transition-colors duration-200 hover:border-border' key={i}>
                                        {fields.map((field) => (
                                            <span key={field.key} className='text-muted'>
                                                {String(item[field.key] ?? '')}
                                            </span>
                                        ))}
                                    </div>
                                ))
                            )
                        ) : (
                            <p className='text-sm text-muted'>{emptyMessage}</p>
                        )}
                    </>
                )}
            </div>
        </>
    );

    if (!showCard) {
        return <div className={className} aria-labelledby={title ? headingId : undefined}>{content}</div>;
    }

    return (
        <div className={cn('p-6 border border-border rounded-2xl shadow-sm', className)} aria-labelledby={title ? headingId : undefined}>
            {content}
        </div>
    );
};

export default EditableKeyValueCard;
