import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import { useNodeForm } from '@/modules/plugin/presentation/hooks';
import { CONTEXT_OPTIONS } from '@/modules/plugin/presentation/utilities/node-types';
import type { IContextData } from '@/modules/plugin/domain/entities';
import type { EditorProps } from '../types';

const CONTEXT_SELECT_OPTIONS = CONTEXT_OPTIONS.map(opt => ({
    value: opt.value,
    title: opt.label
}));

const ContextEditor = ({ node }: EditorProps) => {
    const { field } = useNodeForm<IContextData>(node, 'context', {} as IContextData);

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
