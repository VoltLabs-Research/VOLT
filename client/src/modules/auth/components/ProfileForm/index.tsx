import { profileSchema } from './validation-schema';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Loader from '@/shared/presentation/components/Loader';
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
};

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
            <div className='volt-container d-flex items-center gap-05 color-muted font-size-1' role='status' aria-live='polite' aria-atomic='true'>
                <Loader scale={0.6} isFixed={false} />
                Saving changes...
            </div>
        );
    }

    if (saveState === ProfileSaveState.Saved) {
        saveFeedback = (
            <div className='volt-container d-flex items-center gap-05 font-size-1' role='status' aria-live='polite' aria-atomic='true'>
                <CheckCircle2 size={14} className='color-success' />
                <span>Changes saved</span>
            </div>
        );
    }

    if (saveState === ProfileSaveState.Error) {
        saveFeedback = (
            <div className='volt-container d-flex items-center gap-05 font-size-1 color-danger' role='alert' aria-live='assertive' aria-atomic='true'>
                <AlertCircle size={14} />
                <span>Could not save changes. We will retry after your next edit.</span>
            </div>
        );
    }

    return (
        <form className='d-flex column gap-1' onSubmit={(event) => event.preventDefault()} noValidate>
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
        </form>
    );
};

export default ProfileForm;
