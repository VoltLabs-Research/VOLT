import React, { memo } from 'react';
import FormSchema, { type SectionDef } from '@/modules/canvas/presentation/components/atoms/form/FormSchema';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';

export interface SettingsSubsection {
    label: string;
    icon?: React.ReactNode;
    sections: SectionDef[];
    visible?: boolean;
}

export interface SettingsPanelProps {
    title: string;
    icon: React.ReactNode;
    subsections: SettingsSubsection[];
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ title, icon, subsections }) => {
    return (
        <CollapsibleSection title={title} icon={icon}>
            <div style={{ display: 'grid', gap: 12 }}>
                {subsections.map((sub, idx) => {
                    if (sub.visible === false) return null;
                    return (
                        <div key={idx}>
                            <div style={{ 
                                fontSize: '0.75rem', 
                                color: '#888', 
                                marginBottom: '8px', 
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                {sub.icon}
                                {sub.label}
                            </div>
                            <FormSchema sections={sub.sections} />
                        </div>
                    );
                })}
            </div>
        </CollapsibleSection>
    );
};

export default memo(SettingsPanel);
