import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormField from '@/shared/presentation/components/FormField';
import { useNodeForm } from '@/modules/plugin/presentation/hooks';
import type { IExposureData } from '@/modules/plugin/domain/entities';
import type { EditorProps } from '../types';

const ExposureEditor = ({ node }: EditorProps) => {
    const { field } = useNodeForm<IExposureData>(node, 'exposure', {} as IExposureData);

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
            <FormField
                variant='inline'
                label='3D Canvas'
                fieldType='toggle'
                {...field('canvas')}
            />
            <FormField
                variant='inline'
                label='Raster Output'
                fieldType='toggle'
                {...field('raster')}
            />
        </CollapsibleSection>
    );
};

export default ExposureEditor;
