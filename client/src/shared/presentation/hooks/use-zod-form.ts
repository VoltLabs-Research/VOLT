import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { UseFormProps, FieldValues, UseFormReturn, Resolver } from 'react-hook-form';
import type { ZodSchema } from 'zod';

interface UseZodFormOptions<TSchema extends FieldValues> extends Omit<UseFormProps<TSchema>, 'resolver'> {
    schema: ZodSchema;
};

const useZodForm = <TSchema extends FieldValues>(
    options: UseZodFormOptions<TSchema>
): UseFormReturn<TSchema> => {
    const { schema, ...formOptions } = options;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolver = zodResolver(schema as any) as unknown as Resolver<TSchema>;

    return useForm<TSchema>({
        ...formOptions,
        resolver,
        mode: formOptions.mode ?? 'onBlur'
    });
};

export default useZodForm;
