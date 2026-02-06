import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import { useNodeForm } from '@/modules/plugin/presentation/hooks';
import type { IForEachData } from '@/modules/plugin/domain/entities';
import type { EditorProps } from '../types';

const ForEachEditor = ({ node }: EditorProps) => {
    const { field } = useNodeForm<IForEachData>(node, 'forEach', {} as IForEachData);

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
