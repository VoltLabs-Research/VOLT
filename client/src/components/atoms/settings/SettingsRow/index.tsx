import React from "react";
import Container from "@/components/primitives/Container";
import Paragraph from "@/components/primitives/Paragraph";
import Title from "@/components/primitives/Title";

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
    infoClassName,
    rightClassName = "d-flex items-center",
    leftClassName = "d-flex items-center gap-1"
}) => {
    return (
        <Container className={`d-flex b-soft p-1-5 b-radius-08 items-center content-between sm:column sm:items-start sm:gap-1 ${className}`}>
            <Container className={leftClassName}>
                {left ? (
                    left
                ) : (
                    <>
                        {Icon ? <Icon size={24} /> : null}
                        <Container className={infoClassName + " d-flex column gap-02"}>
                            <Title className='font-size-2-5'>{title}</Title>
                            <Paragraph className="font-size-2">{description}</Paragraph>
                        </Container>
                    </>
                )}

                {left ? (
                    <Container className={infoClassName + ' d-flex column gap-02'}>
                        <Title className='font-size-2-5'>{title}</Title>
                        <Paragraph className="font-size-2">{description}</Paragraph>
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
