import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import { useNodeForm } from '@/modules/plugin/presentation/hooks';
import { CONTEXT_OPTIONS } from '@/modules/plugin/presentation/utilities/node-types';
import type { IContextData, ModifierContext } from '@/modules/plugin/domain/entities';

interface ContextEditorProps {
    node: Node;
};

const CONTEXT_SELECT_OPTIONS = CONTEXT_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const DEFAULT_CONTEXT: IContextData = { source: 'trajectory_dumps' as ModifierContext };

const ContextEditor = ({ node }: ContextEditorProps) => {
    const { field } = useNodeForm(node, 'context', DEFAULT_CONTEXT);

    return (
        <CollapsibleSection title='Data Source' defaultExpanded>
            <FormField
                variant='inline'
                label='Source'
                fieldType='select'
                {...field('source')}
                options={CONTEXT_SELECT_OPTIONS}
            />
        </CollapsibleSection>
    );
};

export default ContextEditor;
