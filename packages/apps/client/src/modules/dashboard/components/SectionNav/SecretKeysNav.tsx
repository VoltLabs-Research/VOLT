import SectionNav from '@/modules/dashboard/components/SectionNav';
import useDefaultSettingsPath from '@/modules/dashboard/hooks/use-default-settings-path';
import { SECRET_KEYS_PATH, SECRET_KEY_METRICS_PATH } from '@/modules/dashboard/utils/sidebar-panels';
import { ChartLine, KeyRound } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface SecretKeysNavProps {
    active: boolean;
    collapsed: boolean;
}

const SecretKeysNav = ({ active, collapsed }: SecretKeysNavProps) => {
    const { pathname } = useLocation();
    const settingsPath = useDefaultSettingsPath();
    const onMetrics = pathname === SECRET_KEY_METRICS_PATH;

    return (
        <SectionNav
            name='secret-keys'
            title='Secret keys'
            backTo={settingsPath}
            links={[
                {
                    label: 'Keys',
                    icon: KeyRound,
                    to: SECRET_KEYS_PATH,
                    // A key's own usage page is one of the keys.
                    isActive: pathname.startsWith(SECRET_KEYS_PATH) && !onMetrics
                },
                {
                    label: 'Metrics',
                    icon: ChartLine,
                    to: SECRET_KEY_METRICS_PATH,
                    isActive: onMetrics
                }
            ]}
            active={active}
            collapsed={collapsed}
        />
    );
};

export default SecretKeysNav;
