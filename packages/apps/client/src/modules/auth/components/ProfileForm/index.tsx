import Loader from '@/shared/ui/components/Loader';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';

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
    hideEmail?: boolean;
}

const AUTO_SAVE_DELAY = 1000;

const ProfileForm = ({
    initialValues,
    onUpdate,
    hideEmail = false
}: ProfileFormProps) => {
    const { control, watch, getValues, formState, reset } = useForm<ProfileFormType>({
        defaultValues: initialValues,
        mode: 'onBlur'
    });

    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const performAutoSaveRef = useRef<() => Promise<void>>(async () => {});
    const isSavingRef = useRef(false);
    const initialValuesRef = useRef(initialValues);
    const [saveState, setSaveState] = useState(ProfileSaveState.Idle);

    const clearPendingAutoSave = useCallback(() => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }
    }, []);

    const hasProfileChanges = useCallback((values: ProfileFormType) => (
        values.fullName !== initialValuesRef.current.fullName
        || values.email !== initialValuesRef.current.email
    ), []);

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

            if (!hasProfileChanges(currentValues)) return;

            try {
                isSavingRef.current = true;
                setSaveState(ProfileSaveState.Saving);
                await onUpdate(currentValues);
                initialValuesRef.current = currentValues;
                setSaveState(ProfileSaveState.Saved);
            } catch {
                setSaveState(ProfileSaveState.Error);
            } finally {
                isSavingRef.current = false;

                if (hasProfileChanges(getValues())) {
                    clearPendingAutoSave();
                    autoSaveTimerRef.current = setTimeout(() => {
                        autoSaveTimerRef.current = null;
                        performAutoSaveRef.current();
                    }, AUTO_SAVE_DELAY);
                }
            }
        };
    }, [clearPendingAutoSave, formState.isValid, getValues, hasProfileChanges, onUpdate]);

    useEffect(() => {
        const subscription = watch((values) => {
            setSaveState((currentState) => currentState === ProfileSaveState.Saving ? currentState : ProfileSaveState.Idle);
            clearPendingAutoSave();

            const currentValues: ProfileFormType = {
                fullName: values.fullName ?? '',
                email: values.email ?? ''
            };

            if (!hasProfileChanges(currentValues)) {
                return;
            }

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
            <div className='flex flex-row items-center gap-2 text-sm' role='status' aria-live='polite' aria-atomic='true'>
                <span className='flex items-center' aria-hidden='true'>
                    <Loader size='sm' color='current' />
                </span>
                <span className='text-sm text-muted'>Saving changes...</span>
            </div>
        );
    }

    if (saveState === ProfileSaveState.Saved) {
        saveFeedback = (
            <div className='flex flex-row items-center gap-2 text-sm' role='status' aria-live='polite' aria-atomic='true'>
                <span className='flex items-center' aria-hidden='true'>
                    <CheckCircle2 size={14} className='text-success' />
                </span>
                <span className='text-sm text-muted'>Changes saved</span>
            </div>
        );
    }

    if (saveState === ProfileSaveState.Error) {
        saveFeedback = (
            <div className='flex flex-row items-center gap-2 text-sm text-danger' role='alert' aria-live='assertive' aria-atomic='true'>
                <span className='flex items-center' aria-hidden='true'>
                    <AlertCircle size={14} />
                </span>
                <span className='text-sm'>Could not save changes. We will retry after your next edit.</span>
            </div>
        );
    }

    return (
        <form
            className='flex flex-col gap-4'
            onSubmit={(event) => event.preventDefault()}
            noValidate
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
            {!hideEmail && (
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
            )}

            {saveFeedback}
        </form>
    );
};

export default ProfileForm;
