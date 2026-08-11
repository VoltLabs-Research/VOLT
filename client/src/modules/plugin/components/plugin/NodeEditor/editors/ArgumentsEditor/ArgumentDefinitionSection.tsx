import { ArgumentType } from '@volt/contracts/modules/plugin/enums';
import { createDefaultArgumentDefinition } from '@/modules/plugin/utils/plugin/argument-values';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import ArgumentDefinitionRow from './ArgumentDefinitionRow';
import DashedActionBox from '@/modules/plugin/components/plugin/DashedActionBox';
import type { SelectOption } from '@/modules/plugin/contracts/select-option';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { IArgumentDefinition } from '@volt/contracts/modules/plugin/workflow';

interface ArgumentDefinitionSectionProps {
    arguments: IArgumentDefinition[];
    onAddArgument: () => void;
    onRemoveArgument: (index: number) => void;
    onUpdateArgument: (index: number, nextArgument: IArgumentDefinition) => void;
    level?: number;
}

const ArgumentDefinitionSection = ({
    arguments: argumentDefinitions,
    onAddArgument,
    onRemoveArgument,
    onUpdateArgument,
    level = 0
}: ArgumentDefinitionSectionProps) => {
    const { publishedPlugins } = usePluginSelectors();
    const [expandedIndex, setExpandedIndex] = useState<number>(-1);

    const pluginOptions = useMemo<SelectOption[]>(() => {
        return publishedPlugins.map((plugin) => ({
            value: plugin._id,
            title: plugin.modifier?.name?.trim() || plugin._id
        }));
    }, [publishedPlugins]);

    const pluginKeyOptions = useMemo<SelectOption[]>(() => {
        const optionsByKey = new Map<string, SelectOption>();

        for (const plugin of publishedPlugins) {
            const key = plugin.modifier?.key?.trim();
            if (!key || optionsByKey.has(key)) {
                continue;
            }

            optionsByKey.set(key, {
                value: key,
                title: `${plugin.modifier?.name?.trim() || plugin._id} (${key})`
            });
        }

        return Array.from(optionsByKey.values());
    }, [publishedPlugins]);

    const handleAddArgument = () => {
        onAddArgument();
        setExpandedIndex(argumentDefinitions.length);
    };

    const handleRemoveArgument = (index: number) => {
        onRemoveArgument(index);
        setExpandedIndex((current) => {
            if (current === index) return -1;
            if (current > index) return current - 1;
            return current;
        });
    };

    const renderNestedSection = (argument: IArgumentDefinition, index: number) => {
        if (argument.type !== ArgumentType.LIST && argument.type !== ArgumentType.TUPLE) {
            return null;
        }

        const nestedArguments = argument.listArguments ?? [];
        const updateNestedArguments = (listArguments: IArgumentDefinition[]) => {
            onUpdateArgument(index, {
                ...argument,
                listArguments
            });
        };

        return (
            <ArgumentDefinitionSection
                arguments={nestedArguments}
                onAddArgument={() => updateNestedArguments([...nestedArguments, createDefaultArgumentDefinition()])}
                onRemoveArgument={(nestedIndex) => {
                    updateNestedArguments(nestedArguments.filter((_, current) => current !== nestedIndex));
                }}
                onUpdateArgument={(nestedIndex, nextNestedArgument) => {
                    updateNestedArguments(nestedArguments.map((nestedArgument, current) => {
                        return current === nestedIndex ? nextNestedArgument : nestedArgument;
                    }));
                }}
                level={level + 1}
            />
        );
    };

    return (
        <div className='flex flex-col gap-1.5'>
            {argumentDefinitions.length === 0 && (
                <div className='rounded-xl border border-dashed border-border px-4 py-5 text-center text-[0.8125rem] text-muted'>
                    No arguments yet. Add one to define user input.
                </div>
            )}

            {argumentDefinitions.map((argument, index) => (
                <ArgumentDefinitionRow
                    key={`${level}-${index}`}
                    argument={argument}
                    siblingArguments={argumentDefinitions.filter((_, current) => current !== index)}
                    index={index}
                    level={level}
                    isExpanded={expandedIndex === index}
                    pluginOptions={pluginOptions}
                    pluginKeyOptions={pluginKeyOptions}
                    nestedArgumentsSection={renderNestedSection(argument, index)}
                    onToggle={() => setExpandedIndex((current) => (current === index ? -1 : index))}
                    onRemove={() => handleRemoveArgument(index)}
                    onUpdate={(nextArgument) => onUpdateArgument(index, nextArgument)}
                />
            ))}

            <DashedActionBox
                icon={<Plus size={14} aria-hidden='true' />}
                label='Add Argument'
                isBlock
                className='mt-2'
                onPress={handleAddArgument}
            />
        </div>
    );
};

export default ArgumentDefinitionSection;
