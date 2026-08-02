import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import type { ArgumentFieldProps } from '@/modules/plugin/contracts/argument-field';

const ArgumentField = (props: ArgumentFieldProps) => (
    <FormFieldRHF {...props} variant='inline' />
);

export default ArgumentField;
