import FormSection from '@/shared/presentation/components/FormSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import IconPicker from '@/shared/presentation/components/IconPicker';
import { Controller } from 'react-hook-form';
import { createNodeEditorForm } from '@/modules/plugin/components/plugin/NodeEditor/hooks/use-node-editor-form';
import type { EditorProps } from '../types';
import { EXPOSURE_EDITOR_DEFAULT_VALUES, exposureEditorSchema } from './schema';
import type { ExposureEditorFormValues } from './schema';

const useExposureEditorForm = createNodeEditorForm<ExposureEditorFormValues, 'exposure'>({
    schema: exposureEditorSchema,
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
                    label='Results Suffix'
                    fieldType='input'
                    name='results'
                    control={form.control}
                    placeholder='results.msgpack'
                />
            </FormSection>
        </>
    );
};

export default ExposureEditor;
