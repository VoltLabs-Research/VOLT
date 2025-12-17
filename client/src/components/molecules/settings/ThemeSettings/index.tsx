import React from "react";
import Section from "@/components/atoms/settings/Section";
import SectionHeader from "@/components/atoms/settings/SectionHeader";
import Container from "@/components/primitives/Container";
import Button from "@/components/primitives/Button";
import "./ThemeSettings.css";
import Title from "@/components/primitives/Title";
import Paragraph from "@/components/primitives/Paragraph";

interface ThemeSettingsProps {
    currentTheme: string;
    onThemeChange: (theme: string) => void;
}

const ThemeSettings: React.FC<ThemeSettingsProps> = ({ currentTheme, onThemeChange }) => {
    const themes = [{
        key: "dark",
        label: "Dark Mode",
        value: "dark"
    }, {
        key: "light",
        label: "Light Mode",
        value: "light"
    }];

    return (
        <Section>
            <SectionHeader
                title="Theme & Appearance"
                description="Customize your interface appearance and preferences"
            />

            <Container className="theme-options gap-1-5">
                {themes.map((t) => (
                    <Container key={t.key} className="d-flex items-center gap-1 sm:column sm:item-start theme-option settings-card settings-card-lg overflow-hidden">
                        <Container className="theme-preview p-relative dark overflow-hidden">
                            <Container className="preview-header"></Container>
                            <Container className="preview-content"></Container>
                        </Container>

                        <Container className="theme-info flex-1">
                            <Title className='font-size-2-5'>{t.label}</Title>
                            <Paragraph>{currentTheme === t.value ? "Currently active" : `Switch to ${t.value} theme`}</Paragraph>
                        </Container>

                        <Container className="a-self-end">
                            <Button variant={currentTheme === t.value ? 'solid' : 'ghost'} intent={currentTheme === t.value ? 'brand' : 'neutral'} size='sm' onClick={() => onThemeChange(t.value)}>
                                {currentTheme === t.value ? "Active" : "Switch"}
                            </Button>
                        </Container>
                    </Container>
                ))}
            </Container>
        </Section>
    );
};

export default ThemeSettings;
