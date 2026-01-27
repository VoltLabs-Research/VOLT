import React from 'react';
import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/shared/presentation/components/atoms/common/CollapsibleSection';
import FormField from '@/shared/presentation/components/molecules/form/FormField';
import { useNodeData } from '../../../../hooks/use-node-data';
import { CONTEXT_OPTIONS } from '../../../../utilities/node-types';
import { ModifierContext } from '../../../../../domain/entities';

interface ContextEditorProps {
    node: Node;
}

interface IContextData {
    source: ModifierContext;
}

const CONTEXT_SELECT_OPTIONS = CONTEXT_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const DEFAULT_CONTEXT: IContextData = { source: ModifierContext.TRAJECTORY_DUMPS };

const ContextEditor: React.FC<ContextEditorProps> = ({ node }) => {
    const { data: context, updateField } = useNodeData(node, 'context', DEFAULT_CONTEXT);

    return (
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
