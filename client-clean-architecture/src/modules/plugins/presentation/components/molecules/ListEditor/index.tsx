import React from 'react';
import FormField from '@/shared/presentation/components/molecules/form/FormField';
import { TbPlus, TbTrash } from 'react-icons/tb';
import Container from '@/shared/presentation/components/primitives/Container';
import Button from '@/shared/presentation/components/primitives/Button';
import Tooltip from '@/shared/presentation/components/atoms/common/Tooltip';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import './ListEditor.css';

interface ListEditorProps {
    items: string[];
    onAdd: () => void;
    onRemove: (index: number) => void;
    onChange: (index: number, value: string) => void;
    label?: string;
    placeholder?: string;
    description?: string;
    addButtonText?: string;
    hideAddButton?: boolean;
}

const ListEditor: React.FC<ListEditorProps> = ({
    items,
    onAdd,
    onRemove,
    onChange,
    label = undefined,
    placeholder = 'Enter value',
    description,
    addButtonText = 'Add Item',
    hideAddButton = false
}) => {
    return (
        <Container className="d-flex column gap-1 items-start">
            {description && (
                <Paragraph className="font-size-1 color-text-secondary">{description}</Paragraph>
            )}

            {items.map((item, index) => (
                <Container key={index} className="d-flex gap-05 w-max content-between items-center">
                    <Container className="d-flex column input-container w-max">
                        {index === 0 && label && <label className="kv-editor-label font-weight-5">{label}</label>}
                        <FormField
                            label=""
                            fieldKey={`item-${index}`}
                            fieldType="input"
                            fieldValue={item}
                            onFieldChange={(_, value) => onChange(index, value as string)}
                            inputProps={{ placeholder }}
                        />
                    </Container>
                    <Tooltip content="Remove" placement="left">
                        <Button
                            variant='ghost'
                            intent='danger'
                            iconOnly
                            size='sm'
                            onClick={() => onRemove(index)}
                        >
                            <TbTrash size={14} />
                        </Button>
                    </Tooltip>
                </Container>
            ))}

            {!hideAddButton && (
                <Button
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    onClick={onAdd}
                    leftIcon={<TbPlus size={14} />}
                >
                    {addButtonText}
                </Button>
            )}
        </Container>
    );
};

export default ListEditor;
