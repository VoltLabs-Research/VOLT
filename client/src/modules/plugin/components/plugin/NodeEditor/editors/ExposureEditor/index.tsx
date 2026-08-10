import FormSection from '@/shared/ui/components/FormSection';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import useNodeEditorForm from '@/modules/plugin/components/plugin/NodeEditor/hooks/use-node-editor-form';
import type { EditorProps } from '@/modules/plugin/contracts/node-editors';
import { EXPOSURE_EDITOR_DEFAULT_VALUES } from './schema';
import type { ExposureEditorFormValues } from './schema';

const ExposureEditor = ({ node }: EditorProps) => {
    const form = useNodeEditorForm<ExposureEditorFormValues>(node, 'exposure', EXPOSURE_EDITOR_DEFAULT_VALUES);

    return (
        <>
            <FormSection title='Exposure'>
                <FormFieldRHF<ExposureEditorFormValues>
                    variant='inline'
                    label='Name'
                    fieldType='input'
                    name='name'
                    control={form.control}
                    placeholder='analysis_results'
                />
            </FormSection>

            <FormSection title='Data'>
                <FormFieldRHF<ExposureEditorFormValues>
                    variant='inline'
                    label='Filename'
                    fieldType='input'
                    name='results'
                    control={form.control}
                    placeholder='results.parquet'
                />
                <FormFieldRHF<ExposureEditorFormValues>
                    variant='inline'
                    label='Id'
                    fieldType='input'
                    name='id'
                    control={form.control}
                    placeholder='(optional) shared pipeline key'
                />
            </FormSection>
        </>
    );
};

export default ExposureEditor;
