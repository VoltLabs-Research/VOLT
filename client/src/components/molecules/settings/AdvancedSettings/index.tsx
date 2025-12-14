import React from "react";
import { TbSettings, TbActivity, TbX } from "react-icons/tb";
import Section from "@/components/atoms/settings/Section";
import SectionHeader from "@/components/atoms/settings/SectionHeader";
import StatusBadge from "@/components/atoms/common/StatusBadge";
import Container from "@/components/primitives/Container";
import SettingsRow from "@/components/atoms/settings/SettingsRow";

const AdvancedSettings: React.FC = () => {
    const rows = [{
        key: "debug",
        icon: TbSettings,
        title: "Debug Mode",
        description: "Enable detailed logging and debugging information",
        right: (
            <StatusBadge variant="inactive">
                <TbX size={14} />
                Disabled
            </StatusBadge>
        )
    }, {
        key: "analytics",
        icon: TbActivity,
        title: "Analytics",
        description: "Share usage data to improve the service",
        right: (
            <StatusBadge variant="active">
                <TbX size={14} />
                    Enabled
            </StatusBadge>
        )
    }];

    return (
        <Container>
            <Section>
                <SectionHeader
                    title="Advanced Settings"
                    description="Developer and advanced configuration options"
                />

                <Container className="d-flex column gap-1">
                    {rows.map((item) => (
                        <SettingsRow
                            key={item.key}
                            icon={item.icon}
                            title={item.title}
                            description={item.description}
                            right={item.right}
                            className="sm:column sm:items-start sm:gap-1"
                            infoClassName="advanced-info"
                        />
                    ))}
                </Container>
            </Section>
        </Container>
    );
};

export default AdvancedSettings;
