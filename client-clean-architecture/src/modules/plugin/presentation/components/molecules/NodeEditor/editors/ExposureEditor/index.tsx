import type { Node } from '@xyflow/react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import { useNodeForm } from '@/modules/plugin/presentation/hooks';
import type { IExposureData } from '@/modules/plugin/domain/entities';

interface ExposureEditorProps {
    node: Node;
};

const DEFAULT_EXPOSURE: IExposureData = { name: '', results: '' };

const ExposureEditor = ({ node }: ExposureEditorProps) => {
    const { field } = useNodeForm(node, 'exposure', DEFAULT_EXPOSURE);

    return (
        <CollapsibleSection title='Results Exposure' defaultExpanded>
            <FormField
                variant='inline'
                label='Exposure Name'
                fieldType='input'
                {...field('name')}
                placeholder='analysis_results'
            />
            <FormField
                variant='inline'
                label='Icon'
                fieldType='input'
                {...field('icon')}
                placeholder='TbChartDots3'
            />
            <FormField
                variant='inline'
                label='Results File Suffix'
                fieldType='input'
                {...field('results')}
                placeholder='results.msgpack'
            />
            <FormField
                variant='inline'
                label='Iterable Path'
                fieldType='input'
                {...field('iterable')}
                placeholder='data.atoms'
            />
            <FormField
                variant='inline'
                label='Iterable Chunk Size'
                fieldType='input'
                {...field('iterableChunkSize')}
                inputProps={{ type: 'number', min: 1 }}
                placeholder='50000'
            />
        </CollapsibleSection>
    );
};

export default ExposureEditor;
