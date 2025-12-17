import React, { useState, useEffect } from "react";
import FormInput from "@/components/atoms/form/FormInput";
import RecentActivity from "@/components/molecules/auth/RecentActivity";
import { TbCheck, TbTrash, TbX, TbActivity, TbCamera } from "react-icons/tb";
import authApi from "@/services/api/auth";
import Section from "@/components/atoms/settings/Section";
import SectionHeader from "@/components/atoms/settings/SectionHeader";
import StatusBadge from "@/components/atoms/common/StatusBadge";
import { useFormValidation } from "@/hooks/useFormValidation";
import Container from "@/components/primitives/Container";
import Button from "@/components/primitives/Button";
import "./GeneralSettings.css";
import Title from "@/components/primitives/Title";
import Paragraph from "@/components/primitives/Paragraph";

interface GeneralSettingsProps {
    user: { firstName?: string; lastName?: string; email?: string; avatar?: string } | null;
    userData: { firstName: string; lastName: string; email: string };
    isUpdating: boolean;
    updateError: string | null;
    onFieldChange: (field: string, value: string) => void;
    onDeleteAccount: () => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({
    user,
    userData,
    isUpdating,
    updateError,
    onFieldChange,
    onDeleteAccount
}) => {
    const [formData, setFormData] = useState({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email
    });

    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const { errors, checkField } = useFormValidation({
        firstName: { required: true, minLength: 4, maxLength: 16, message: "First name must be between 4 and 16 characters" },
        lastName: { required: true, minLength: 4, maxLength: 16, message: "Last name must be between 4 and 16 characters" },
        email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Invalid email address" }
    });

    useEffect(() => {
        if (user) {
            setFormData({
                firstName: user.firstName || "",
                lastName: user.lastName || "",
                email: user.email || ""
            });
        }
    }, [user]);

    const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData((prev) => ({ ...prev, [field]: value }));

        const errorMessage = checkField(field, value);
        if (!errorMessage) {
            onFieldChange(field, value);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("Please upload an image file");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert("File size must be less than 5MB");
            return;
        }

        const fd = new FormData();
        fd.append("avatar", file);

        try {
            setIsUploadingAvatar(true);
            await authApi.updateMe(fd);
            window.location.reload();
        } catch (error) {
            alert("Failed to upload avatar. Please try again.");
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const fields = [{
        key: "firstName",
        label: "First name",
        value: userData.firstName
    }, {
        key: "lastName",
        label: "Last name",
        value: userData.lastName
    }];

    return (
        <Container className="d-flex gap-2 column">
            <Section className="profile-section">
                <Container className="d-flex items-center gap-1-5 sm:column sm:text-center">
                    <Container className="f-shrink-0">
                        <Container
                            className="profile-avatar-container p-relative overflow-hidden cursor-pointer"
                            onClick={() => document.getElementById("avatar-upload")?.click()}
                        >
                            {user?.avatar ? (
                                <img src={user.avatar} alt="Profile" className="profile-avatar-img w-max h-max" />
                            ) : (
                                <Container className="d-flex flex-center avatar-circle font-size-5 font-weight-6">
                                    {user?.firstName?.[0]}
                                    {user?.lastName?.[0]}
                                </Container>
                            )}

                            <Container className="p-absolute flex-center d-flex profile-avatar-overlay w-max h-max">
                                {isUploadingAvatar ? (
                                    <TbActivity className="animate-spin" size={24} />
                                ) : (
                                    <TbCamera size={24} />
                                )}
                            </Container>
                        </Container>

                        <input
                            type="file"
                            id="avatar-upload"
                            className="avatar-upload-input"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            disabled={isUploadingAvatar}
                        />
                    </Container>

                    <Container className="flex-1">
                        <Title className='font-size-4 profile-name font-weight-6 color-primary'>
                            {user?.firstName} {user?.lastName}
                        </Title>
                        <Paragraph className='profile-email font-size-3 color-secondary'>{user?.email}</Paragraph>
                        <Container className="d-flex items-center gap-05">
                            <StatusBadge variant="active">
                                <TbCheck size={14} />
                                Active Account
                            </StatusBadge>
                        </Container>
                    </Container>
                </Container>
            </Section>

            <Section className="d-flex column gap-3">
                <SectionHeader title="Personal Information" description="Update your personal details and contact information" />

                <div className="settings-form d-flex column gap-2">
                    {updateError && (
                        <div className="update-error">
                            <TbX size={16} />
                            {updateError}
                        </div>
                    )}

                    <div className="form-row gap-1-5">
                        {fields.map((f) => (
                            <div key={f.key} className="form-field-container p-relative w-max">
                                <FormInput
                                    value={f.value}
                                    label={f.label}
                                    onChange={handleInputChange(f.key as keyof typeof formData)}
                                    disabled={isUpdating}
                                    error={(errors as any)[f.key]}
                                />
                                {isUpdating && (
                                    <div className="update-indicator p-absolute font-size-1 color-secondary">
                                        <TbActivity size={16} />
                                        Updating...
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="form-field-container p-relative w-max">
                        <FormInput
                            value={userData.email}
                            label="Email address"
                            onChange={handleInputChange("email")}
                            disabled={isUpdating}
                            error={errors.email}
                        />
                        {isUpdating && (
                            <div className="update-indicator p-absolute font-size-1 color-secondary">
                                <TbActivity size={16} />
                                Updating...
                            </div>
                        )}
                    </div>
                </div>
            </Section>

            <RecentActivity 
                limit={15} 
                showStats={true} 
                className="account-activity-section" />

            <Section className="danger-section d-flex column gap-1-5">
                <SectionHeader 
                    title="Danger Zone" 
                    description="Irreversible and destructive actions" />

                <Container className="danger-item d-flex items-center content-between">
                    <Container className="danger-info">
                        <Title className='font-size-2-5'>Delete Account</Title>
                        <Paragraph>Permanently delete your account and all associated data. This action cannot be undone.</Paragraph>
                    </Container>
                    <Button variant='soft' intent='danger' leftIcon={<TbTrash size={16} />} onClick={onDeleteAccount}>
                        Delete Account
                    </Button>
                </Container>
            </Section>
        </Container>
    );
};

export default GeneralSettings;
