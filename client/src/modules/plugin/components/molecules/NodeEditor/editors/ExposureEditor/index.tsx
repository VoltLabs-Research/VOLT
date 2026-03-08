import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import useNodeFormRHF from '@/modules/plugin/hooks/use-node-form-rhf';
import { z } from 'zod/v4';
import type { EditorProps } from '../types';

const exposureEditorSchema = z.object({
    name: z.string().default(''),
    icon: z.string().default(''),
    results: z.string().default(''),
    iterable: z.string().default(''),
    iterableChunkSize: z.union([z.number(), z.string()]).default(''),
    canvas: z.boolean().default(false),
    raster: z.boolean().default(false)
}).strict();

type ExposureEditorFormValues = z.infer<typeof exposureEditorSchema>;

const DEFAULT_VALUES: ExposureEditorFormValues = {
    name: '',
    icon: '',
    results: '',
    iterable: '',
    iterableChunkSize: '',
    canvas: false,
    raster: false
};

const ExposureEditor = ({ node }: EditorProps) => {
    const form = useNodeFormRHF<ExposureEditorFormValues>({
        schema: exposureEditorSchema,
        nodeId: node.id,
        dataKey: 'exposure',
        node,
        defaultValue: DEFAULT_VALUES
    });

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
