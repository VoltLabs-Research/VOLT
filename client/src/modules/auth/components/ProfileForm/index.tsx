import { profileSchema } from './validation-schema';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { InlineStatus, Loader, Stack } from '@voltstack/bravais';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { ProfileForm as ProfileFormType } from './validation-schema';

enum ProfileSaveState {
    Idle = 'idle',
    Saving = 'saving',
    Saved = 'saved',
    Error = 'error'
}

interface ProfileFormProps {
    initialValues: ProfileFormType;
    onUpdate: (data: ProfileFormType) => Promise<void>;
}

const AUTO_SAVE_DELAY = 1000;
const PROFILE_FORM_FIELDS: Array<keyof ProfileFormType> = ['fullName', 'email'];

const ProfileForm = ({
    initialValues,
    onUpdate
}: ProfileFormProps) => {
    const { control, watch, getValues, formState, reset } = useForm<ProfileFormType>({
        resolver: zodResolver(profileSchema),
        defaultValues: initialValues,
        mode: 'onBlur'
    });

    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const performAutoSaveRef = useRef<() => Promise<void>>(async () => {});
    const isSavingRef = useRef(false);
    const initialValuesRef = useRef(initialValues);
    const onUpdateRef = useRef(onUpdate);
    const [saveState, setSaveState] = useState(ProfileSaveState.Idle);

    const clearPendingAutoSave = useCallback(() => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
    }, []);

    const hasProfileChanges = useCallback((values: ProfileFormType) => {
        return PROFILE_FORM_FIELDS.some((key) => values[key] !== initialValuesRef.current[key]);
    }, []);

    useEffect(() => {
        onUpdateRef.current = onUpdate;
    }, [onUpdate]);

    useEffect(() => {
        initialValuesRef.current = initialValues;
        clearPendingAutoSave();
        reset(initialValues);
        setSaveState(ProfileSaveState.Idle);
    }, [clearPendingAutoSave, initialValues, reset]);

    useEffect(() => {
        performAutoSaveRef.current = async () => {
            if (isSavingRef.current) return;
            if (!formState.isValid) return;

            const currentValues = getValues();
            const hasChanged = hasProfileChanges(currentValues);

            if (!hasChanged) return;

            try {
                isSavingRef.current = true;
                setSaveState(ProfileSaveState.Saving);
                await onUpdateRef.current(currentValues);
                initialValuesRef.current = currentValues;
                setSaveState(ProfileSaveState.Saved);
            } catch {
                setSaveState(ProfileSaveState.Error);
            } finally {
                isSavingRef.current = false;

                const latestValues = getValues();
                if (hasProfileChanges(latestValues)) {
                    clearPendingAutoSave();
                    autoSaveTimerRef.current = setTimeout(() => {
                        autoSaveTimerRef.current = null;
                        performAutoSaveRef.current();
                    }, AUTO_SAVE_DELAY);
                }
            }
        };
    }, [clearPendingAutoSave, formState.isValid, getValues, hasProfileChanges]);

    useEffect(() => {
        const subscription = watch((values) => {
            const currentValues: ProfileFormType = {
                fullName: values.fullName ?? '',
                email: values.email ?? ''
            };

            if (!hasProfileChanges(currentValues)) {
                clearPendingAutoSave();
                setSaveState((currentState) => currentState === ProfileSaveState.Saving ? currentState : ProfileSaveState.Idle);

                return;
            }

            setSaveState((currentState) => currentState === ProfileSaveState.Saving ? currentState : ProfileSaveState.Idle);

            clearPendingAutoSave();
            autoSaveTimerRef.current = setTimeout(() => {
                autoSaveTimerRef.current = null;
                performAutoSaveRef.current();
            }, AUTO_SAVE_DELAY);
        });

        return () => {
            subscription.unsubscribe();
            clearPendingAutoSave();
        };
    }, [watch, clearPendingAutoSave, hasProfileChanges]);

    let saveFeedback = null;

    if (saveState === ProfileSaveState.Saving) {
        saveFeedback = (
            <InlineStatus tone='muted' icon={<Loader scale={0.6} isFixed={false} />}>
                Saving changes...
            </InlineStatus>
        );
    }

    if (saveState === ProfileSaveState.Saved) {
        saveFeedback = (
            <InlineStatus tone='muted' icon={<CheckCircle2 size={14} className='color-success' />}>
                Changes saved
            </InlineStatus>
        );
    }

    if (saveState === ProfileSaveState.Error) {
        saveFeedback = (
            <InlineStatus tone='danger' severity='alert' live='assertive' icon={<AlertCircle size={14} />}>
                Could not save changes. We will retry after your next edit.
            </InlineStatus>
        );
    }

    return (
        <Stack
            as='form'
            gap='1'
            {...({
                onSubmit: (event: React.FormEvent<HTMLFormElement>) => event.preventDefault(),
                noValidate: true
            } as React.FormHTMLAttributes<HTMLFormElement>)}
        >
            <FormFieldRHF
                name='fullName'
                control={control}
                label='Full Name'
                placeholder='Enter your full name'
                inputProps={{
                    autoComplete: 'name',
                    inputMode: 'text',
                    spellCheck: false,
                    name: 'fullName'
                }}
            />

            <FormFieldRHF
                name='email'
                control={control}
                label='Email'
                type='email'
                placeholder='Enter your email'
                inputProps={{
                    autoComplete: 'email',
                    inputMode: 'email',
                    spellCheck: false,
                    name: 'email',
                    autoCapitalize: 'none',
                    autoCorrect: 'off'
                }}
            />

            {saveFeedback}
        </Stack>
    );
};

export default ProfileForm;
