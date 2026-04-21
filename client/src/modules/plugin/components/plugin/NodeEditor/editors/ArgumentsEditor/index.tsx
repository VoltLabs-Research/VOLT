import useNodeCollectionForm from '@/modules/plugin/hooks/plugin/use-node-collection-form';
import { createDefaultArgumentDefinition } from '@/modules/plugin/utilities/plugin/argument-values';
import ArgumentDefinitionSection from './ArgumentDefinitionSection';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';
import type { EditorProps } from '../types';

const ArgumentsEditor = ({ node }: EditorProps) => {
    const {
        items: args,
        addItem,
        removeItem,
        updateItems
    } = useNodeCollectionForm<IArgumentDefinition>(
        node,
        'arguments',
        'arguments',
        createDefaultArgumentDefinition
    );

    const handleUpdateArgument = (index: number, nextArgument: IArgumentDefinition) => {
        updateItems(args.map((argument, argumentIndex) => {
            if (argumentIndex !== index) {
                return argument;
            }

            return nextArgument;
        }));
    };

    return (
        <ArgumentDefinitionSection
            arguments={args}
            onAddArgument={addItem}
            onRemoveArgument={removeItem}
            onUpdateArgument={handleUpdateArgument}
        />
    );
};

export default ArgumentsEditor;
