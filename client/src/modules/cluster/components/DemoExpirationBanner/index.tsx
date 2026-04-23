import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Row, Text } from '@/shared/presentation/primitives';
import { useDemoClusterStore } from '@/modules/cluster/stores/use-demo-cluster-store';
import { useDemoClusterCountdown } from '@/modules/cluster/hooks/use-demo-cluster-countdown';
import { sileo } from 'sileo';
import './DemoExpirationBanner.css';

const pad = (value: number): string => String(value).padStart(2, '0');

const DemoExpirationBanner = () => {
    const navigate = useNavigate();
    const isDemo = useDemoClusterStore((state) => state.isDemo);
    const expiresAt = useDemoClusterStore((state) => state.expiresAt);
    const clear = useDemoClusterStore((state) => state.clear);
    const { minutes, seconds, expired } = useDemoClusterCountdown(expiresAt);
    const expiredHandled = useRef(false);

    useEffect(() => {
        if (!isDemo || !expired || expiredHandled.current) return;
        expiredHandled.current = true;
        sileo.info({
            title: 'Demo session expired',
            description: 'Your temporary environment has been removed.'
        });
        clear();
        navigate('/onboarding/cluster/setup?reason=demo-expired', { replace: true });
    }, [isDemo, expired, clear, navigate]);

    if (!isDemo || !expiresAt) return null;

    return (
        <Row
            justify='center'
            align='center'
            gap='075'
            className='demo-expiration-banner'
            role='status'
            aria-live='polite'
        >
            <Text className='demo-expiration-banner-text'>
                You&apos;re using a temporal container that expires in {pad(minutes)}:{pad(seconds)}
            </Text>
            <Link
                to='/onboarding/cluster/setup'
                className='demo-expiration-banner-cta'
            >
                Connect a Cluster
                <span aria-hidden='true'>&nbsp;→</span>
            </Link>
        </Row>
    );
};

export default DemoExpirationBanner;
