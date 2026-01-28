import React from "react";
import { TbBrandGithub, TbBrandGoogle, TbBrandOpenai, TbBrain, TbFileText } from "react-icons/tb";
import Section from "@/features/settings/atoms/Section";
import SectionHeader from "@/features/settings/atoms/SectionHeader";
import Container from "@/components/primitives/Container";
import Button from "@/components/primitives/Button";
import SettingsRow from "@/features/settings/atoms/SettingsRow";
import "@/features/settings/components/molecules/IntegrationsSettings/IntegrationsSettings.css";
import Title from "@/components/primitives/Title";
import Paragraph from "@/components/primitives/Paragraph";

const IntegrationsSettings: React.FC = () => {
    const integrations = [{
        key: "github",
        icon: TbBrandGithub,
        title: "GitHub",
        description: "Sync repositories and manage code",
        action: <Button variant='ghost' intent='neutral' size='sm'>Connect</Button>
    }, {
        key: "google-drive",
        icon: TbBrandGoogle,
        title: "Google Drive",
        description: "Access and sync your files",
        action: <Button variant='ghost' intent='neutral' size='sm'>Connect</Button>
    }, {
        key: "gemini",
        icon: TbBrain,
        title: "Gemini",
        description: "AI-powered assistance and analysis",
        action: <Button variant='ghost' intent='neutral' size='sm'>Connect</Button>
    }, {
        key: "openai",
        icon: TbBrandOpenai,
        title: "OpenAI",
        description: "Advanced AI models and capabilities",
        action: <Button variant='ghost' intent='neutral' size='sm'>Connect</Button>
    }];

    return (
        <Section>
            <SectionHeader
                title="Third-party Integrations"
                description="Connect your account with external services and platforms"
            />

            <Container className="integrations-grid gap-1">
                {integrations.map((item) => (
                    <SettingsRow
                        key={item.key}
                        title={item.title}
                        description={item.description}
                        left={
                            <Container className="d-flex flex-center integration-icon color-primary">
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

            <Container className="integration-help b-soft b-radius-08 p-1-5 d-flex gap-1-5 column">
                <Container className="d-flex column gap-05">
                    <Title className='font-size-2-5'>Need help with integrations?</Title>
                    <Paragraph>Check our documentation or contact support for assistance with setting up third-party connections.</Paragraph>
                </Container>
                <Container className="d-flex gap-1 flex-wrap">
                    <Button variant='ghost' intent='neutral' size='sm' leftIcon={<TbFileText size={16} />}>
                        Documentation
                    </Button>
                </Container>
            </Container>
        </Section>
    );
};

export default IntegrationsSettings;
