import React from "react";
import { TbDownload, TbX } from "react-icons/tb";
import Section from "@/components/atoms/settings/Section";
import SectionHeader from "@/components/atoms/settings/SectionHeader";
import Container from "@/components/primitives/Container";
import SettingsRow from "@/components/atoms/settings/SettingsRow";

const DataExportSettings: React.FC = () => {
    const rows = [{
        key: "export",
        icon: TbDownload,
        title: "Export Data",
        description: "Download all your data in JSON format",
        right: (
            <button className="d-flex items-center gap-05 action-button">
                <TbDownload size={16} />
                Export
            </button>
        )
    }, {
        key: "delete",
        icon: TbX,
        title: "Delete Account",
        description: "Permanently delete your account and all data",
        right: (
            <button className="d-flex items-center gap-05 action-button danger">
                <TbX size={16} />
                Delete
            </button>
        )
    }];

    return (
        <Section>
            <SectionHeader title="Data & Privacy" description="Manage your data and privacy settings" />

            <Container className="d-flex gap-1 column">
                {rows.map((item) => (
                    <SettingsRow
                        key={item.key}
                        icon={item.icon}
                        title={item.title}
                        description={item.description}
                        right={
                            <Container className="a-self-end">
                                {item.right}
                            </Container>
                        }
                        className="data-item sm:column sm:items-start sm:gap-1"
                        infoClassName="data-info"
                        rightClassName=""
                    />
                ))}
            </Container>
        </Section>
    );
};

export default DataExportSettings;