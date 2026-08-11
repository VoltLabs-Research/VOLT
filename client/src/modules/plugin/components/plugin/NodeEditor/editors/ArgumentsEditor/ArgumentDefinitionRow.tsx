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
import { Chip, cn } from '@heroui/react';
import { PluginMultiSelect } from '@/modules/plugin/components/plugin/PluginSelect';
import { getMultiSelectTriggerLabel } from '@/modules/plugin/contracts/select-option';
import type { SelectOption } from '@/modules/plugin/contracts/select-option';
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
        <div className='group'>
            <div className='flex flex-row items-center gap-1.5 rounded-xl py-1 pl-1.5 pr-2'>
                <button
                    type='button'
                    className='inline-flex min-w-0 flex-1 cursor-pointer flex-row items-center gap-2 rounded-md border-none bg-transparent px-1 py-1.5 text-left text-foreground hover:bg-surface-hover focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--focus)]'
                    onClick={onToggle}
                    aria-expanded={isExpanded}
                    aria-controls={`argument-row-body-${fieldPrefix}`}
                >
                    <ChevronRight
                        size={14}
                        className={cn('shrink-0 text-muted transition-transform duration-150 ease-out', isExpanded ? 'rotate-90' : null)}
                        aria-hidden='true'
                    />
                    <span className={cn('min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis text-[0.8125rem] font-medium', argumentLabel ? null : 'italic text-muted')}>
                        {displayLabel}
                    </span>
                    <Chip size='sm' variant='soft' className='shrink-0 rounded-full px-1.5 py-[0.05rem] text-[0.65rem] font-medium'>
                        {ARGUMENT_TYPE_SELECT_OPTIONS.find((option) => option.value === argument.type)?.title ?? argument.type}
                    </Chip>
                </button>
                <button
                    type='button'
                    className='inline-flex size-7 shrink-0 cursor-pointer flex-row items-center justify-center rounded-md border-none bg-transparent p-0 text-muted opacity-0 transition-[opacity,color,background-color] duration-[120ms] ease-out hover:bg-surface-hover hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--focus)] group-hover:opacity-100 group-focus-within:opacity-100'
                    onClick={onRemove}
                    aria-label={`Delete ${displayLabel}`}
                    title='Delete argument'
                >
                    <Trash2 size={14} aria-hidden='true' />
                </button>
            </div>

            {isExpanded && (
                <div className='flex flex-col border-t border-border py-3' id={`argument-row-body-${fieldPrefix}`}>
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
                            <h4 className='mt-5 mb-2 ml-1 text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-muted'>Options</h4>
                            <div className='p-1'>
                                <ArgumentOptionsEditor
                                    options={argument.options ?? []}
                                    onOptionsChange={(nextOptions) => onUpdate(applyArgumentOptionsEdit(argument, nextOptions))}
                                />
                            </div>
                        </>
                    )}

                    {isListLike && (
                        <>
                            <h4 className='mt-5 mb-2 ml-1 text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-muted'>
                                {argument.type === ArgumentType.TUPLE ? 'Tuple Components' : 'Nested Arguments'}
                            </h4>
                            <div className='p-1 mt-2'>
                                {nestedArgumentsSection}
                            </div>
                        </>
                    )}

                    {isPluginReference && (
                        <>
                            <h4 className='mt-5 mb-2 ml-1 text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-muted'>Allowed Plugins</h4>
                            <div className='p-1'>
                                <div className='flex flex-col gap-2'>
                                    <PluginMultiSelect
                                        id={`plugin-reference-filter-${fieldPrefix}`}
                                        options={pluginOptions}
                                        selectedValues={argument.pluginReferenceFilter ?? []}
                                        onMultiChange={(nextValues) => editPluginFilter('pluginReferenceFilter', nextValues)}
                                        hasSearch
                                        searchPlaceholder='Search plugins…'
                                        placeholder='Select plugins'
                                        ariaLabel='Allowed plugins'
                                        renderTriggerLabel={(selectedCount) => getMultiSelectTriggerLabel(
                                            selectedCount,
                                            argument.pluginReferenceFilter,
                                            pluginOptions,
                                            'Select plugins',
                                            'selected'
                                        )}
                                    />
                                    <PluginMultiSelect
                                        id={`plugin-reference-filter-keys-${fieldPrefix}`}
                                        options={pluginKeyOptions}
                                        selectedValues={argument.pluginReferenceFilterKeys ?? []}
                                        onMultiChange={(nextValues) => editPluginFilter('pluginReferenceFilterKeys', nextValues)}
                                        hasSearch
                                        searchPlaceholder='Search portable keys…'
                                        placeholder='Select portable keys'
                                        ariaLabel='Allowed portable keys'
                                        renderTriggerLabel={(selectedCount) => getMultiSelectTriggerLabel(
                                            selectedCount,
                                            argument.pluginReferenceFilterKeys,
                                            pluginKeyOptions,
                                            'Select portable keys',
                                            'keys selected'
                                        )}
                                    />
                                </div>
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
                            <h4 className='mt-5 mb-2 ml-1 text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-muted'>Argument Mappings</h4>
                            <div className='p-1'>
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
