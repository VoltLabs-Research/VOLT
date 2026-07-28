import FormSection from '@/shared/ui/components/FormSection';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import IconPicker from '@/shared/ui/components/IconPicker';
import { Controller } from 'react-hook-form';
import { createNodeEditorForm } from '@/modules/plugin/components/plugin/NodeEditor/hooks/use-node-editor-form';
import type { EditorProps } from '@/modules/plugin/contracts/node-editors';
import { EXPOSURE_EDITOR_DEFAULT_VALUES } from './schema';
import type { ExposureEditorFormValues } from './schema';

const useExposureEditorForm = createNodeEditorForm<ExposureEditorFormValues, 'exposure'>({
    defaults: EXPOSURE_EDITOR_DEFAULT_VALUES,
    dataKey: 'exposure'
});

const ExposureEditor = ({ node }: EditorProps) => {
    const form = useExposureEditorForm(node);

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
                <div className='form-field-inline'>
                    <label className='form-field-inline-label'>Icon</label>
                    <div className='render-input-container'>
                        <Controller
                            name='icon'
                            control={form.control}
                            render={({ field }) => (
                                <IconPicker
                                    value={typeof field.value === 'string' ? field.value : ''}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </div>
                </div>
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
