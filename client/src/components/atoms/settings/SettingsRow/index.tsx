import React from "react";
import Container from "@/components/primitives/Container";

type IconType = React.ComponentType<{ size?: number; className?: string }>;

type SettingsRowProps = {
    title: string;
    description: React.ReactNode;

    icon?: IconType;
    left?: React.ReactNode;

    right?: React.ReactNode;

    className?: string;
    infoClassName?: string;
    rightClassName?: string;
    leftClassName?: string;
};

const SettingsRow: React.FC<SettingsRowProps> = ({
    title,
    description,
    icon: Icon,
    left,
    right,
    className = "",
    infoClassName = "advanced-info",
    rightClassName = "d-flex items-center",
    leftClassName = "d-flex items-center gap-1"
}) => {
    return (
        <Container className={`d-flex items-center content-between sm:column sm:items-start sm:gap-1 ${className}`}>
            <Container className={leftClassName}>
                {left ? (
                    left
                ) : (
                    <>
                        {Icon ? <Icon size={24} /> : null}
                        <Container className={infoClassName}>
                            <h4>{title}</h4>
                            <p>{description}</p>
                        </Container>
                    </>
                )}

                {left ? (
                    <Container className={infoClassName}>
                        <h4>{title}</h4>
                        <p>{description}</p>
                    </Container>
                ) : null}
            </Container>

            {right ? (
                <Container className={rightClassName}>
                    {right}
                </Container>
            ) : null}
        </Container>
    );
};

export default SettingsRow;
