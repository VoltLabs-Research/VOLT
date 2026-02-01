import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import { useNodeForm } from '@/modules/plugin/presentation/hooks';
import type { IForEachData } from '@/modules/plugin/domain/entities';

interface ForEachEditorProps {
    node: Node;
};

const DEFAULT_FOREACH: IForEachData = { iterableSource: '' };

const ForEachEditor = ({ node }: ForEachEditorProps) => {
    const { field } = useNodeForm(node, 'forEach', DEFAULT_FOREACH);

    return (
        <CollapsibleSection title='Iteration' defaultExpanded>
            <FormField
                variant='inline'
                label='Iterable Source'
                fieldType='input'
                {...field('iterableSource')}
                placeholder='{{ Context.trajectory_dumps }}'
            />
        </CollapsibleSection>
    );
};

export default ForEachEditor;
