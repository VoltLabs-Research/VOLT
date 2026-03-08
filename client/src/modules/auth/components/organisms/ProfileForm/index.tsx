import { profileSchema } from './validation-schema';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Loader from '@/shared/presentation/components/Loader';
import useZodForm from '@/shared/presentation/hooks/use-zod-form';
import { sileo } from 'sileo';
import { useCallback, useEffect, useRef } from 'react';
import type { ProfileForm as ProfileFormType } from './validation-schema';

interface ProfileFormProps {
    initialValues: ProfileFormType;
    onUpdate: (data: ProfileFormType) => Promise<void>;
};

const AUTO_SAVE_DELAY = 1000;
const PROFILE_FORM_FIELDS: Array<keyof ProfileFormType> = ['fullName', 'email'];

const ProfileForm = ({
    initialValues,
    onUpdate
}: ProfileFormProps) => {
    const { control, watch, getValues, formState, reset } = useZodForm<ProfileFormType>({
        schema: profileSchema,
        defaultValues: initialValues,
        mode: 'onBlur'
    });

    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSavingRef = useRef(false);
    const initialValuesRef = useRef(initialValues);
    const onUpdateRef = useRef(onUpdate);

    useEffect(() => {
        onUpdateRef.current = onUpdate;
    }, [onUpdate]);

    useEffect(() => {
        initialValuesRef.current = initialValues;
        reset(initialValues);
    }, [initialValues, reset]);

    const performAutoSave = useCallback(async () => {
        if (isSavingRef.current) return;
        if (!formState.isValid) return;

        const currentValues = getValues();
        const hasChanged = PROFILE_FORM_FIELDS.some(
            (key) => currentValues[key] !== initialValuesRef.current[key]
        );

        if (!hasChanged) return;

        try {
            isSavingRef.current = true;
            await onUpdateRef.current(currentValues);
            initialValuesRef.current = currentValues;
        } catch {
            sileo.error({ title: 'Auto-save failed' });
        } finally {
            isSavingRef.current = false;
        }
    }, [formState.isValid, getValues]);

    useEffect(() => {
        const subscription = watch(() => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
            autoSaveTimerRef.current = setTimeout(performAutoSave, AUTO_SAVE_DELAY);
        });

        return () => {
            subscription.unsubscribe();
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [watch, performAutoSave]);

    return (
        <Container className='d-flex column gap-1'>
            <FormFieldRHF
                name='fullName'
                control={control}
                label='Full Name'
                placeholder='Enter your full name'
            />

            <FormFieldRHF
                name='email'
                control={control}
                label='Email'
                type='email'
                placeholder='Enter your email'
            />

            {isSavingRef.current && (
                <Container className='d-flex items-center gap-05 color-muted font-size-1'>
                    <Loader scale={0.6} isFixed={false} />
                    Saving changes...
                </Container>
            )}
        </Container>
    );
};

export default ProfileForm;
