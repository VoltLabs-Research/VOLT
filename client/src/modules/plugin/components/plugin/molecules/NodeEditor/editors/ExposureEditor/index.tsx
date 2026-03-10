import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { createNodeEditorForm } from '@/shared/forms';
import type { EditorProps } from '../types';
import { EXPOSURE_EDITOR_DEFAULT_VALUES, exposureEditorSchema, type ExposureEditorFormValues } from './schema';

const useExposureEditorForm = createNodeEditorForm<ExposureEditorFormValues, 'exposure'>({
    schema: exposureEditorSchema,
    defaults: EXPOSURE_EDITOR_DEFAULT_VALUES,
    dataKey: 'exposure'
});

const ExposureEditor = ({ node }: EditorProps) => {
    const form = useExposureEditorForm(node);

    return (
        <CollapsibleSection title='Results Exposure' defaultExpanded>
            <FormFieldRHF<ExposureEditorFormValues>
                variant='inline'
                label='Exposure Name'
                fieldType='input'
                name='name'
                control={form.control}
                placeholder='analysis_results'
            />
            <FormFieldRHF<ExposureEditorFormValues>
                variant='inline'
                label='Icon'
                fieldType='input'
                name='icon'
                control={form.control}
                placeholder='TbChartDots3'
            />
            <FormFieldRHF<ExposureEditorFormValues>
                variant='inline'
                label='Results File Suffix'
                fieldType='input'
                name='results'
                control={form.control}
                placeholder='results.msgpack'
            />
            <FormFieldRHF<ExposureEditorFormValues>
                variant='inline'
                label='Iterable Path'
                fieldType='input'
                name='iterable'
                control={form.control}
                placeholder='data.atoms'
            />
            <FormFieldRHF<ExposureEditorFormValues>
                variant='inline'
                label='Iterable Chunk Size'
                fieldType='input'
                name='iterableChunkSize'
                control={form.control}
                inputProps={{ type: 'number', min: 1 }}
                placeholder='50000'
            />
            <FormFieldRHF<ExposureEditorFormValues>
                variant='inline'
                label='3D Canvas'
                fieldType='checkbox'
                name='canvas'
                control={form.control}
            />
            <FormFieldRHF<ExposureEditorFormValues>
                variant='inline'
                label='Raster Output'
                fieldType='checkbox'
                name='raster'
                control={form.control}
            />
        </CollapsibleSection>
    );
};

export default ExposureEditor;
