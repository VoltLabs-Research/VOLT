import { Heading, Row, Stack, Text } from '@voltstack/bravais';
import { Container } from 'lucide-react';
import { useId } from 'react';
import './DockerNeededState.css';

interface DockerNeededStateProps {
    /** What the user came here to do, named as the feature they clicked. */
    feature: string;
};

/**
 * Stands in for a feature that needs a container runtime the cluster does not have.
 *
 * Shown in place of the feature rather than hiding it from navigation, because a
 * missing menu entry reads as "Volt cannot do this" while an explanation reads as
 * "this machine cannot do this yet". Everything else in the product works without
 * a container runtime — trajectories, analyses and plugins all run as local
 * processes — so this is one screen out of order, not a degraded install.
 */
const DockerNeededState = ({ feature }: DockerNeededStateProps) => {
    const headingId = useId();

    return (
        <Row as='section' aria-labelledby={headingId} justify='center' width='max' height='max' className='docker-needed-container'>
            <Stack align='center' gap='1-5' textAlign='center' className='docker-needed-content'>
                <Row justify='center' className='docker-needed-icon'>
                    <Container size={24} />
                </Row>

                <Stack gap='05' textAlign='center'>
                    <Heading level={2} id={headingId}>
                        {`${feature} needs a container runtime`}
                    </Heading>
                    <Text size='md' tone='secondary' lineHeight='5'>
                        This cluster&apos;s machine has no container runtime available, so Volt cannot start
                        containers on it. Install Docker there and this page works on the next heartbeat.
                    </Text>
                    <Text size='sm' tone='secondary' lineHeight='5'>
                        Nothing else is affected: trajectories, analyses and plugins do not use containers.
                    </Text>
                </Stack>
            </Stack>
        </Row>
    );
};

export default DockerNeededState;
