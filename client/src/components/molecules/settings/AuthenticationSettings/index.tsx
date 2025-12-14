import React from "react";
import FormInput from "@/components/atoms/form/FormInput";
import { TbShield, TbX, TbEdit, TbActivity, TbDots } from "react-icons/tb";
import Section from "@/components/atoms/settings/Section";
import SectionHeader from "@/components/atoms/settings/SectionHeader";
import StatusBadge from "@/components/atoms/common/StatusBadge";
import { useFormValidation } from "@/hooks/useFormValidation";
import Container from "@/components/primitives/Container";
import SettingsRow from "@/components/atoms/settings/SettingsRow";
import "./AuthenticationSettings.css";

interface PasswordInfo {
    lastChanged?: string;
}

interface AuthenticationSettingsProps {
    isLoadingPasswordInfo: boolean;
    passwordInfo: PasswordInfo | null;
    showPasswordForm: boolean;
    setShowPasswordForm: (v: boolean) => void;
    passwordForm: { currentPassword: string; newPassword: string; confirmPassword: string };
    setPasswordForm: React.Dispatch<React.SetStateAction<{ currentPassword: string; newPassword: string; confirmPassword: string }>>;
    isChangingPassword: boolean;
    onSubmitPassword: (e: React.FormEvent) => void;
    loginActivities: any[];
    loginActivityLoading: boolean;
    onOpenLoginActivity: () => void;
}

const AuthenticationSettings: React.FC<AuthenticationSettingsProps> = ({
    isLoadingPasswordInfo,
    passwordInfo,
    showPasswordForm,
    setShowPasswordForm,
    passwordForm,
    setPasswordForm,
    isChangingPassword,
    onSubmitPassword,
    onOpenLoginActivity
}) => {
    const { errors, validate, checkField } = useFormValidation({
        currentPassword: { required: true, message: "Current password is required" },
        newPassword: {
            required: true,
            minLength: 8,
            maxLength: 16,
            message: "Password must be between 8 and 16 characters"
        },
        confirmPassword: {
            required: true,
            validate: (value, formData) => value === formData?.newPassword || "Passwords do not match"
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate(passwordForm)) {
            onSubmitPassword(e);
        }
    };

    const handlePasswordChange =
        (field: keyof typeof passwordForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            setPasswordForm((prev) => ({ ...prev, [field]: value }));

            const formData = field === "confirmPassword" ? { newPassword: passwordForm.newPassword } : undefined;
            checkField(field, value, formData);
        };

    const items = [
        {
            key: "2fa",
            left: (
                <Container className="d-flex flex-center security-icon">
                    <TbShield size={24} />
                </Container>
            ),
            title: "Two-Factor Authentication",
            description: "Add an extra layer of security to your account",
            right: (
                <StatusBadge variant="inactive">
                    <TbX size={14} />
                    Disabled
                </StatusBadge>
            ),
            after: null
        },
        {
            key: "password",
            left: (
                <Container className="d-flex flex-center security-icon">
                    <TbShield size={24} />
                </Container>
            ),
            title: "Password",
            description: isLoadingPasswordInfo
                ? "Loading..."
                : passwordInfo?.lastChanged
                    ? `Last changed ${passwordInfo.lastChanged}`
                    : "Password information unavailable",
            right: (
                <button className="action-button" onClick={() => setShowPasswordForm(!showPasswordForm)}>
                    <TbEdit size={16} />
                    {showPasswordForm ? "Cancel" : "Change"}
                </button>
            ),
            after: showPasswordForm ? (
                <div className="password-form">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <FormInput
                                type="password"
                                label="Current Password"
                                value={passwordForm.currentPassword}
                                onChange={handlePasswordChange("currentPassword")}
                                required
                                error={errors.currentPassword}
                            />
                        </div>
                        <div className="form-group">
                            <FormInput
                                type="password"
                                label="New Password"
                                value={passwordForm.newPassword}
                                onChange={handlePasswordChange("newPassword")}
                                required
                                error={errors.newPassword}
                            />
                        </div>
                        <div className="form-group">
                            <FormInput
                                type="password"
                                label="Confirm New Password"
                                value={passwordForm.confirmPassword}
                                onChange={handlePasswordChange("confirmPassword")}
                                required
                                error={errors.confirmPassword}
                            />
                        </div>
                        <div className="form-actions">
                            <button
                                type="button"
                                className="action-button secondary"
                                onClick={() => setShowPasswordForm(false)}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="action-button primary" disabled={isChangingPassword}>
                                {isChangingPassword ? "Changing..." : "Change Password"}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null
        },
        {
            key: "login-activity",
            left: (
                <Container className="d-flex flex-center security-icon">
                    <TbActivity size={24} />
                </Container>
            ),
            title: "Login Activity",
            description: "Monitor your account access and sessions",
            right: (
                <button className="action-button" onClick={onOpenLoginActivity}>
                    <TbDots size={16} />
                    View
                </button>
            ),
            after: null
        }
    ] as const;

    return (
        <Section>
            <SectionHeader
                title="Security Settings"
                description="Manage your account security and authentication methods"
            />

            <Container className="d-flex column gap-1">
                {items.map((item) => (
                    <Container key={item.key} className="security-item">
                        <SettingsRow
                            left={item.left}
                            title={item.title}
                            description={item.description}
                            right={item.right}
                            infoClassName="security-info flex-1"
                            leftClassName="d-flex items-center gap-1"
                            rightClassName="d-flex items-center gap-05"
                        />
                        {item.after}
                    </Container>
                ))}
            </Container>
        </Section>
    );
};

export default AuthenticationSettings;