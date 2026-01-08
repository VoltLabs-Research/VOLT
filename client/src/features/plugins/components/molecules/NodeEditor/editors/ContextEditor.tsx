import React from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/components/atoms/common/CollapsibleSection';
import FormField from '@/components/molecules/form/FormField';
import { useNodeData } from '@/features/plugins/hooks/use-node-data';
import { CONTEXT_OPTIONS } from '@/utilities/plugins/node-types';
import type { IContextData, ModifierContext } from '@/types/plugin';

interface ContextEditorProps {
    node: Node;
}

// Convert to SelectOption format(value, title)
const CONTEXT_SELECT_OPTIONS = CONTEXT_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const DEFAULT_CONTEXT: IContextData = { source: 'trajectory_dumps' as ModifierContext };

const ContextEditor: React.FC<ContextEditorProps> = ({ node }) => {
    const { data: context, updateField } = useNodeData(node, 'context', DEFAULT_CONTEXT);

    return(
        <CollapsibleSection title='Data Source' defaultExpanded>
            <FormField
                label='Source'
                fieldKey='source'
                fieldType='select'
                fieldValue={context.source || ''}
                onFieldChange={updateField}
                options={CONTEXT_SELECT_OPTIONS}
            />
        </CollapsibleSection>
    );
};

export default ContextEditor;
