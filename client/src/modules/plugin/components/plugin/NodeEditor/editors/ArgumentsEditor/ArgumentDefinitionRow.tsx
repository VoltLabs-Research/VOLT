import {
    ArgumentType,
    ArgumentVisibilityOperator
} from '@volt/contracts/modules/plugin/enums';
import { isPluginReferenceArgumentType } from '@/modules/plugin/utils/plugin/argument-values';
import ArgumentField from './ArgumentField';
import ArgumentOptionsEditor from './ArgumentOptionsEditor';
import PluginReferenceMappingsEditor from './PluginReferenceMappingsEditor';
import {
    ARGUMENT_TYPE_SELECT_OPTIONS,
    ARGUMENT_VISIBILITY_OPERATOR_OPTIONS,
    BOOLEAN_ARGUMENT_VALUE_OPTIONS
} from './argument-definition-constants';
import {
    applyArgumentFieldEdit,
    applyArgumentOptionsEdit,
    applyVisibilityOperatorEdit,
    applyVisibilityValueEdit
} from './argument-definition-edits';
import {
    formatArgumentInputValue,
    getArgumentLabel,
    getVisibilityValueInput,
    isMultiValueVisibilityOperator
} from './argument-definition-helpers';
import FormSection from '@/shared/ui/components/FormSection';
import { Select, Stack, Tag, getMultiSelectTriggerLabel } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { ChevronRight, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { IArgumentDefinition } from '@volt/contracts/modules/plugin/workflow';

interface ArgumentDefinitionRowProps {
    argument: IArgumentDefinition;
    siblingArguments: IArgumentDefinition[];
    index: number;
    level: number;
    isExpanded: boolean;
    pluginOptions: SelectOption[];
    pluginKeyOptions: SelectOption[];
    nestedArgumentsSection: ReactNode;
    onToggle: () => void;
    onRemove: () => void;
    onUpdate: (nextArgument: IArgumentDefinition) => void;
}

const ArgumentDefinitionRow = ({
    argument,
    siblingArguments,
    index,
    level,
    isExpanded,
    pluginOptions,
    pluginKeyOptions,
    nestedArgumentsSection,
    onToggle,
    onRemove,
    onUpdate
}: ArgumentDefinitionRowProps) => {
    const fieldPrefix = `${level}-${index}`;
    const argumentLabel = getArgumentLabel(argument);
    const displayLabel = argumentLabel || `Argument ${index + 1}`;
    const visibilityCondition = argument.visibleWhen;
    const isPluginReference = isPluginReferenceArgumentType(argument.type);
    const isListLike = argument.type === ArgumentType.LIST || argument.type === ArgumentType.TUPLE;

    const referenceArguments = siblingArguments.filter((candidate) => candidate.argument.trim().length > 0);
    const referenceOptions = referenceArguments.map((candidate) => ({
        value: candidate.argument,
        title: getArgumentLabel(candidate)
    }));
    const visibilityReferenceType = referenceArguments
        .find((candidate) => candidate.argument === visibilityCondition?.argument)
        ?.type;

    const editField = (field: keyof IArgumentDefinition, rawValue: string) => {
        onUpdate(applyArgumentFieldEdit(argument, field, rawValue));
    };

    const editPluginFilter = (
        field: 'pluginReferenceFilter' | 'pluginReferenceFilterKeys',
        nextValues: string[]
    ) => {
        onUpdate({
            ...argument,
            [field]: nextValues.length > 0 ? nextValues : undefined
        });
    };

    const editVisibility = (nextCondition: IArgumentDefinition['visibleWhen']) => {
        const nextArgument: IArgumentDefinition = {
            ...argument,
            visibleWhen: nextCondition
        };

        if (!nextCondition) {
            delete nextArgument.visibleWhen;
        }

        onUpdate(nextArgument);
    };

    const scalarOptions: SelectOption[] | undefined = argument.type === ArgumentType.BOOLEAN
        ? BOOLEAN_ARGUMENT_VALUE_OPTIONS
        : argument.type === ArgumentType.SELECT
            ? (argument.options ?? [])
                .filter((option) => option.key.trim().length > 0)
                .map((option) => ({
                    value: option.key,
                    title: option.label?.trim() ? `${option.label} (${option.key})` : option.key
                }))
            : undefined;
    const scalarFieldType: 'input' | 'select' = scalarOptions ? 'select' : 'input';

    return (
        <div className={`argument-row ${isExpanded ? 'is-expanded' : ''}`}>
            <div className='argument-row-header'>
                <button
                    type='button'
                    className='argument-row-toggle'
                    onClick={onToggle}
                    aria-expanded={isExpanded}
                    aria-controls={`argument-row-body-${fieldPrefix}`}
                >
                    <ChevronRight size={14} className='argument-row-chevron' aria-hidden='true' />
                    <span className={`argument-row-title ${argumentLabel ? '' : 'argument-row-title--placeholder'}`}>
                        {displayLabel}
                    </span>
                    <Tag size='xs' className='argument-row-type-badge'>
                        {ARGUMENT_TYPE_SELECT_OPTIONS.find((option) => option.value === argument.type)?.title ?? argument.type}
                    </Tag>
                </button>
                <button
                    type='button'
                    className='argument-row-delete'
                    onClick={onRemove}
                    aria-label={`Delete ${displayLabel}`}
                    title='Delete argument'
                >
                    <Trash2 size={14} aria-hidden='true' />
                </button>
            </div>

            {isExpanded && (
                <div className='argument-row-body' id={`argument-row-body-${fieldPrefix}`}>
                    <FormSection title='General'>
                        <ArgumentField
                            label='Key'
                            name={`argument-${fieldPrefix}`}
                            value={argument.argument}
                            onChange={(event) => editField('argument', event.target.value)}
                            placeholder='my_argument'
                        />
                        <ArgumentField
                            label='Label'
                            name={`label-${fieldPrefix}`}
                            value={argument.label}
                            onChange={(event) => editField('label', event.target.value)}
                            placeholder='My Argument'
                        />
                        <ArgumentField
                            label='Type'
                            name={`type-${fieldPrefix}`}
                            fieldType='select'
                            value={argument.type}
                            onChange={(event) => editField('type', event.target.value)}
                            options={ARGUMENT_TYPE_SELECT_OPTIONS}
                        />
                    </FormSection>

                    {argument.type === ArgumentType.NUMBER && (
                        <FormSection title='Constraints'>
                            <ArgumentField
                                label='Min'
                                name={`min-${fieldPrefix}`}
                                value={argument.min ?? ''}
                                onChange={(event) => editField('min', event.target.value)}
                                placeholder='0'
                                inputProps={{ type: 'number' }}
                            />
                            <ArgumentField
                                label='Max'
                                name={`max-${fieldPrefix}`}
                                value={argument.max ?? ''}
                                onChange={(event) => editField('max', event.target.value)}
                                placeholder='100'
                                inputProps={{ type: 'number' }}
                            />
                            <ArgumentField
                                label='Step'
                                name={`step-${fieldPrefix}`}
                                value={argument.step ?? ''}
                                onChange={(event) => editField('step', event.target.value)}
                                placeholder='1'
                                inputProps={{ type: 'number' }}
                            />
                        </FormSection>
                    )}

                    {(argument.type === ArgumentType.SELECT || isPluginReference) && (
                        <FormSection title='Selection'>
                            <ArgumentField
                                label='Multiple'
                                name={`multiple-selection-${fieldPrefix}`}
                                fieldType='checkbox'
                                value={Boolean(argument.multipleSelection)}
                                onChange={(event) => editField('multipleSelection', event.target.value)}
                            />
                        </FormSection>
                    )}

                    {!isListLike && !isPluginReference && (
                        <FormSection title='Values'>
                            {!argument.inferFromContext && (
                                <>
                                    <ArgumentField
                                        label='Value'
                                        name={`value-${fieldPrefix}`}
                                        fieldType={scalarFieldType}
                                        value={formatArgumentInputValue(argument.value)}
                                        onChange={(event) => editField('value', event.target.value)}
                                        options={scalarOptions}
                                        placeholder='Preset hidden value'
                                    />
                                    <ArgumentField
                                        label='Default'
                                        name={`default-${fieldPrefix}`}
                                        fieldType={scalarFieldType}
                                        value={formatArgumentInputValue(argument.default)}
                                        onChange={(event) => editField('default', event.target.value)}
                                        options={scalarOptions}
                                        placeholder='Default value'
                                    />
                                </>
                            )}
                            <ArgumentField
                                label='Infer From Context'
                                name={`infer-from-context-${fieldPrefix}`}
                                fieldType='checkbox'
                                value={Boolean(argument.inferFromContext)}
                                onChange={(event) => editField('inferFromContext', event.target.value)}
                            />
                        </FormSection>
                    )}

                    <FormSection title='Visibility'>
                        <ArgumentField
                            label='Conditional'
                            name={`visibility-enabled-${fieldPrefix}`}
                            fieldType='checkbox'
                            value={Boolean(visibilityCondition)}
                            onChange={(event) => editVisibility(event.target.value === 'true' ? {
                                argument: referenceOptions[0]?.value ?? '',
                                operator: ArgumentVisibilityOperator.EQUALS
                            } : undefined)}
                        />
                        {visibilityCondition && (
                            <>
                                <ArgumentField
                                    label='Depends on'
                                    name={`visibility-argument-${fieldPrefix}`}
                                    fieldType='select'
                                    value={visibilityCondition.argument}
                                    onChange={(event) => editVisibility({
                                        ...visibilityCondition,
                                        argument: event.target.value
                                    })}
                                    options={referenceOptions}
                                />
                                <ArgumentField
                                    label='Operator'
                                    name={`visibility-operator-${fieldPrefix}`}
                                    fieldType='select'
                                    value={visibilityCondition.operator}
                                    onChange={(event) => editVisibility(applyVisibilityOperatorEdit(
                                        visibilityCondition,
                                        event.target.value as ArgumentVisibilityOperator
                                    ))}
                                    options={ARGUMENT_VISIBILITY_OPERATOR_OPTIONS}
                                />
                                <ArgumentField
                                    label={isMultiValueVisibilityOperator(visibilityCondition.operator) ? 'Values' : 'Value'}
                                    name={`visibility-value-${fieldPrefix}`}
                                    value={getVisibilityValueInput(visibilityCondition)}
                                    onChange={(event) => editVisibility(applyVisibilityValueEdit(
                                        visibilityCondition,
                                        event.target.value,
                                        visibilityReferenceType
                                    ))}
                                    placeholder={visibilityReferenceType === ArgumentType.BOOLEAN
                                        ? 'true'
                                        : isMultiValueVisibilityOperator(visibilityCondition.operator)
                                            ? 'PTM, ACNA'
                                            : 'PTM'}
                                />
                            </>
                        )}
                    </FormSection>

                    {argument.type === ArgumentType.SELECT && (
                        <>
                            <h4 className='argument-row-subheading text-eyebrow'>Options</h4>
                            <div className='argument-row-subblock'>
                                <ArgumentOptionsEditor
                                    options={argument.options ?? []}
                                    onOptionsChange={(nextOptions) => onUpdate(applyArgumentOptionsEdit(argument, nextOptions))}
                                />
                            </div>
                        </>
                    )}

                    {isListLike && (
                        <>
                            <h4 className='argument-row-subheading text-eyebrow'>
                                {argument.type === ArgumentType.TUPLE ? 'Tuple Components' : 'Nested Arguments'}
                            </h4>
                            <div className='argument-row-subblock argument-row-nested'>
                                {nestedArgumentsSection}
                            </div>
                        </>
                    )}

                    {isPluginReference && (
                        <>
                            <h4 className='argument-row-subheading text-eyebrow'>Allowed Plugins</h4>
                            <div className='argument-row-subblock'>
                                <Stack gap='05'>
                                    <Select
                                        id={`plugin-reference-filter-${fieldPrefix}`}
                                        options={pluginOptions}
                                        isMulti
                                        selectedValues={argument.pluginReferenceFilter ?? []}
                                        onMultiChange={(nextValues) => editPluginFilter('pluginReferenceFilter', nextValues)}
                                        hasSearch
                                        placeholder='Select plugins'
                                        renderTriggerLabel={(selectedCount) => getMultiSelectTriggerLabel(
                                            selectedCount,
                                            argument.pluginReferenceFilter,
                                            pluginOptions,
                                            'Select plugins',
                                            'selected'
                                        )}
                                    />
                                    <Select
                                        id={`plugin-reference-filter-keys-${fieldPrefix}`}
                                        options={pluginKeyOptions}
                                        isMulti
                                        selectedValues={argument.pluginReferenceFilterKeys ?? []}
                                        onMultiChange={(nextValues) => editPluginFilter('pluginReferenceFilterKeys', nextValues)}
                                        hasSearch
                                        placeholder='Select portable keys'
                                        renderTriggerLabel={(selectedCount) => getMultiSelectTriggerLabel(
                                            selectedCount,
                                            argument.pluginReferenceFilterKeys,
                                            pluginKeyOptions,
                                            'Select portable keys',
                                            'keys selected'
                                        )}
                                    />
                                </Stack>
                            </div>
                            <FormSection title='Plugin Reference'>
                                <ArgumentField
                                    label='Required'
                                    name={`plugin-reference-required-${fieldPrefix}`}
                                    fieldType='checkbox'
                                    value={Boolean(argument.required)}
                                    onChange={(event) => editField('required', event.target.value)}
                                />
                                <ArgumentField
                                    label='Show config'
                                    name={`plugin-reference-config-${fieldPrefix}`}
                                    fieldType='checkbox'
                                    value={Boolean(argument.showPluginConfiguration)}
                                    onChange={(event) => editField('showPluginConfiguration', event.target.value)}
                                />
                            </FormSection>
                            <h4 className='argument-row-subheading text-eyebrow'>Argument Mappings</h4>
                            <div className='argument-row-subblock'>
                                <PluginReferenceMappingsEditor
                                    mappings={argument.pluginReferenceMappings ?? []}
                                    fieldPrefix={fieldPrefix}
                                    sourceArgumentOptions={referenceOptions}
                                    pluginOptions={pluginOptions}
                                    pluginKeyOptions={pluginKeyOptions}
                                    onMappingsChange={(pluginReferenceMappings) => onUpdate({
                                        ...argument,
                                        pluginReferenceMappings
                                    })}
                                />
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ArgumentDefinitionRow;
