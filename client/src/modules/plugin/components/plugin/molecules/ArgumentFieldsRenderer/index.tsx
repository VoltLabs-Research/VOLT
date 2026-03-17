import { ArgumentType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import {
    coerceArgumentInputValue,
    createDefaultListItem,
    getListArgumentValue,
    getPrimitiveArgumentFieldValue
} from '@/modules/plugin/utilities/plugin/argument-values';
import PluginConfigField from '@/modules/plugin/components/plugin/molecules/PluginConfigField';
import Button from '@/shared/presentation/components/Button';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';
import type { FormFieldAutocompleteOption } from '@/shared/presentation/components/FormFieldRHF';
import type { SelectOption } from '@/shared/presentation/components/Select';

interface ArgumentFieldsRendererProps {
    arguments: IArgumentDefinition[];
    values: Record<string, unknown>;
    onChange: (key: string, value: unknown) => void;
    frameOptions?: SelectOption[];
    emptyMessage?: string;
    path?: string;
    autocompleteOptions?: FormFieldAutocompleteOption[];
};

interface ListItemValue {
    [key: string]: unknown;
};

interface PrimitiveFieldConfig {
    fieldType: 'input' | 'select' | 'checkbox';
    fieldValue: string | number | boolean;
    options?: SelectOption[];
    inputProps?: {
        type: 'number';
        step?: number;
        min?: number;
        max?: number;
    };
};

const getPrimitiveFieldConfig = (
    argument: IArgumentDefinition,
    value: unknown,
    frameOptions: SelectOption[]
): PrimitiveFieldConfig => {
    if (argument.type === ArgumentType.BOOLEAN) {
        return {
            fieldType: 'checkbox',
            fieldValue: getPrimitiveArgumentFieldValue(argument, value)
        };
    }

    if (argument.type === ArgumentType.SELECT) {
        return {
            fieldType: 'select',
            fieldValue: getPrimitiveArgumentFieldValue(argument, value),
            options: (argument.options ?? []).map((option) => ({
                value: option.key,
                title: option.label
            }))
        };
    }

    if (argument.type === ArgumentType.FRAME) {
        return {
            fieldType: 'select',
            fieldValue: getPrimitiveArgumentFieldValue(argument, value),
            options: frameOptions
        };
    }

    if (argument.type === ArgumentType.NUMBER) {
        return {
            fieldType: 'input',
            fieldValue: getPrimitiveArgumentFieldValue(argument, value),
            inputProps: {
                type: 'number',
                step: argument.step,
                min: argument.min,
                max: argument.max
            }
        };
    }

    return {
        fieldType: 'input',
        fieldValue: getPrimitiveArgumentFieldValue(argument, value)
    };
};

const ArgumentFieldsRenderer = ({
    arguments: argumentDefinitions,
    values,
    onChange,
    frameOptions,
    emptyMessage = 'No arguments configured.',
    path = 'root',
    autocompleteOptions
}: ArgumentFieldsRendererProps) => {
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    const resolvedFrameOptions = useMemo(() => frameOptions ?? [], [frameOptions]);

    const setSectionExpanded = useCallback((sectionKey: string, nextValue: boolean) => {
        setExpandedSections((previousState) => ({
            ...previousState,
            [sectionKey]: nextValue
        }));
    }, []);

    const handlePrimitiveChange = useCallback((argument: IArgumentDefinition, nextValue: string | number | boolean) => {
        onChange(argument.argument, coerceArgumentInputValue(argument, nextValue));
    }, [onChange]);

    const handleListItemChange = useCallback((
        argument: IArgumentDefinition,
        items: ListItemValue[],
        itemIndex: number,
        nestedKey: string,
        nextValue: unknown
    ) => {
        const nextItems = items.map((item, index) => {
            if (index !== itemIndex) {
                return item;
            }

            return {
                ...item,
                [nestedKey]: nextValue
            };
        });

        onChange(argument.argument, nextItems);
    }, [onChange]);

    const handleListItemRemove = useCallback((argument: IArgumentDefinition, items: ListItemValue[], itemIndex: number) => {
        onChange(argument.argument, items.filter((_, index) => index !== itemIndex));
    }, [onChange]);

    const handleListItemAdd = useCallback((argument: IArgumentDefinition, listPath: string, items: ListItemValue[]) => {
        const nextItemIndex = items.length;
        onChange(argument.argument, [...items, createDefaultListItem(argument.listArguments)]);
        setSectionExpanded(`${listPath}.${nextItemIndex}`, true);
    }, [onChange, setSectionExpanded]);

    const renderListItem = useCallback((argument: IArgumentDefinition, items: ListItemValue[], listPath: string) => {
        return (item: ListItemValue, itemIndex: number) => {
            const itemPath = `${listPath}.${itemIndex}`;
            const nestedArguments = argument.listArguments ?? [];
            const isExpanded = expandedSections[itemPath] ?? itemIndex === 0;

            return (
                <CollapsibleSection
                    key={itemPath}
                    title={`Item ${itemIndex + 1}`}
                    expanded={isExpanded}
                    onExpandedChange={(nextValue) => setSectionExpanded(itemPath, nextValue)}
                    onDelete={() => handleListItemRemove(argument, items, itemIndex)}
                    deleteActionLabel={`Remove ${argument.label || argument.argument} item ${itemIndex + 1}`}
                    className='mb-0'
                    bodyClassName='mt-05'
                >
                    <ArgumentFieldsRenderer
                        arguments={nestedArguments}
                        values={item}
                        onChange={(nestedKey, nextValue) => handleListItemChange(argument, items, itemIndex, nestedKey, nextValue)}
                        frameOptions={resolvedFrameOptions}
                        emptyMessage='No nested arguments configured.'
                        path={itemPath}
                        autocompleteOptions={autocompleteOptions}
                    />
                </CollapsibleSection>
            );
        };
    }, [expandedSections, handleListItemChange, handleListItemRemove, resolvedFrameOptions, setSectionExpanded]);

    const renderArgument = useCallback((argument: IArgumentDefinition, index: number) => {
        const argumentValue = values[argument.argument];
        const fieldKey = `${path}.${argument.argument}.${index}`;

        if (argument.type === ArgumentType.PLUGIN_CONFIG) {
            return (
                <PluginConfigField
                    key={fieldKey}
                    argument={argument}
                    value={argumentValue}
                    onChange={onChange}
                    fieldKey={fieldKey}
                    frameOptions={resolvedFrameOptions}
                />
            );
        }

        if (argument.type === ArgumentType.LIST) {
            const items = getListArgumentValue(argument, argumentValue);

            return (
                <Container key={fieldKey} className='d-flex column gap-05'>
                    <Paragraph className='canvas-form-label'>
                        {argument.label || argument.argument}
                    </Paragraph>
                    {items.length > 0 ? items.map(renderListItem(argument, items, fieldKey)) : (
                        <Paragraph className='font-size-1 color-muted'>No items added.</Paragraph>
                    )}
                    <Button
                        variant='outline'
                        intent='neutral'
                        size='sm'
                        className='w-max'
                        leftIcon={<Plus size={12} />}
                        onClick={() => handleListItemAdd(argument, fieldKey, items)}
                    >
                        Add New
                    </Button>
                </Container>
            );
        }

        const fieldConfig = getPrimitiveFieldConfig(argument, argumentValue, resolvedFrameOptions);

        return (
            <FormFieldRHF
                key={fieldKey}
                label={argument.label || argument.argument}
                fieldKey={fieldKey}
                fieldType={fieldConfig.fieldType}
                fieldValue={fieldConfig.fieldValue}
                options={fieldConfig.options}
                inputProps={fieldConfig.inputProps}
                onFieldChange={(_, nextValue) => handlePrimitiveChange(argument, nextValue)}
                variant='canvas'
                autocomplete={autocompleteOptions?.length ? { options: autocompleteOptions } : undefined}
            />
        );
    }, [autocompleteOptions, handleListItemAdd, handlePrimitiveChange, onChange, path, renderListItem, resolvedFrameOptions, values]);

    if (!argumentDefinitions.length) {
        return (
            <Paragraph className='font-size-1 color-muted'>
                {emptyMessage}
            </Paragraph>
        );
    }

    return (
        <Container className='d-flex column gap-05'>
            {argumentDefinitions.map(renderArgument)}
        </Container>
    );
};

export default ArgumentFieldsRenderer;
