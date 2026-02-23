import React from 'react';
import Container from '@/shared/presentation/components/Container';
import FormField from '@/shared/presentation/components/FormField';
import Loader from '@/shared/presentation/components/Loader';
import useForm from '@/shared/presentation/hooks/use-form';
import { profileSchema, ProfileForm as ProfileFormType } from './validation-schema';

interface ProfileFormProps {
    initialValues: ProfileFormType;
    onUpdate: (data: ProfileFormType) => Promise<void>;
}

const ProfileForm: React.FC<ProfileFormProps> = ({
    initialValues,
    onUpdate
}) => {
    const form = useForm<ProfileFormType>({
        initialValues,
        schema: profileSchema,
        validateOnChange: false,
        validateOnBlur: true,
        onAutoSave: onUpdate,
        autoSaveDelay: 1000,
        autoSaveOnlyIfChanged: true
    });

    return (
        <Container className="d-flex column gap-1">
            <FormField
                label="Full Name"
                type="text"
                placeholder="Enter your full name"
                {...form.field('fullName')}
            />

            <FormField
                label="Email"
                type="email"
                placeholder="Enter your email"
                {...form.field('email')}
            />

            {form.isAutoSaving && (
                <Container className="d-flex items-center gap-05 color-muted font-size-1">
                    <Loader scale={0.6} isFixed={false} />
                    Saving changes...
                </Container>
            )}
        </Container>
    );
};

export default ProfileForm;
