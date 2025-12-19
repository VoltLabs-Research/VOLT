import React from 'react';
import FormField from '@/components/molecules/form/FormField';
import { TbPlus, TbTrash } from 'react-icons/tb';
import Container from '@/components/primitives/Container';
import Button from '@/components/primitives/Button';
import Paragraph from '@/components/primitives/Paragraph';

interface ListEditorProps {
    items: string[];
    onAdd: () => void;
    onRemove: (index: number) => void;
    onChange: (index: number, value: string) => void;
    label?: string;
    placeholder?: string;
    description?: string;
    addButtonText?: string;
}

const ListEditor: React.FC<ListEditorProps> = ({
    items,
    onAdd,
    onRemove,
    onChange,
    label = 'Item',
    placeholder = 'Enter value',
    description,
    addButtonText = 'Add Item'
}) => {
    return (
        <Container className="d-flex column gap-1 items-start">
            {description && (
                <Paragraph className="font-size-1 color-text-secondary">{description}</Paragraph>
            )}

            {items.map((item, index) => (
                <Container key={index} className="d-flex gap-05 w-max content-between items-center">
                    <Container className="d-flex column flex-1">
                        {index === 0 && <label className="kv-editor-label font-weight-5">{label}</label>}
                        <FormField
                            label=""
                            fieldKey={`item-${index}`}
                            fieldType="input"
                            fieldValue={item}
                            onFieldChange={(_, value) => onChange(index, value as string)}
                            inputProps={{ placeholder }}
                        />
                    </Container>
                    <Button
                        variant='ghost'
                        intent='danger'
                        iconOnly
                        size='sm'
                        onClick={() => onRemove(index)}
                        style={{ marginTop: index === 0 ? '1.25rem' : 0 }}
                    >
                        <TbTrash size={14} />
                    </Button>
                </Container>
            ))}

            <Button
                variant='ghost'
                intent='secondary'
                size='sm'
                onClick={onAdd}
                leftIcon={<TbPlus size={14} />}
            >
                {addButtonText}
            </Button>
        </Container>
    );
};

export default ListEditor;
