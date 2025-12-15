import React from "react";
import { TbBrandGithub, TbBrandGoogle, TbBrandOpenai, TbBrain, TbFileText } from "react-icons/tb";
import Section from "@/components/atoms/settings/Section";
import SectionHeader from "@/components/atoms/settings/SectionHeader";
import Container from "@/components/primitives/Container";
import SettingsRow from "@/components/atoms/settings/SettingsRow";
import "./IntegrationsSettings.css";
import Title from "@/components/primitives/Title";
import Paragraph from "@/components/primitives/Paragraph";

const IntegrationsSettings: React.FC = () => {
    const integrations = [{
        key: "github",
        icon: TbBrandGithub,
        title: "GitHub",
        description: "Sync repositories and manage code",
        action: <button className="action-button">Connect</button>
    }, {
        key: "google-drive",
        icon: TbBrandGoogle,
        title: "Google Drive",
        description: "Access and sync your files",
        action: <button className="action-button">Connect</button>
    }, {
        key: "gemini",
        icon: TbBrain,
        title: "Gemini",
        description: "AI-powered assistance and analysis",
        action: <button className="action-button">Connect</button>
    }, {
        key: "openai",
        icon: TbBrandOpenai,
        title: "OpenAI",
        description: "Advanced AI models and capabilities",
        action: <button className="action-button">Connect</button>
    }];

    return (
        <Section>
            <SectionHeader
                title="Third-party Integrations"
                description="Connect your account with external services and platforms"
            />

            <Container className="integrations-grid">
                {integrations.map((item) => (
                    <SettingsRow
                        key={item.key}
                        title={item.title}
                        description={item.description}
                        left={
                            <Container className="d-flex flex-center integration-icon">
                                <item.icon size={24} />
                            </Container>
                        }
                        right={
                            <Container className="sm:a-self-end d-flex items-center gap-05">
                                {item.action}
                            </Container>
                        }
                        className="d-flex items-center content-between sm:column sm:align-start sm:gap-1 integration-item"
                        infoClassName="integration-info flex-1"
                        leftClassName="d-flex items-center gap-1"
                        rightClassName=""
                    />
                ))}
            </Container>

            <Container className="integration-help">
                <Title className='font-size-2-5'>Need help with integrations?</Title>
                <Paragraph>Check our documentation or contact support for assistance with setting up third-party connections.</Paragraph>
                <Container className="d-flex gap-1 flex-wrap">
                    <button className="action-button">
                        <TbFileText size={16} />
                        Documentation
                    </button>
                </Container>
            </Container>
        </Section>
    );
};

export default IntegrationsSettings;
