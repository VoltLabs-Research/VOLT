import './ClusterInstallCommandPicker.css';
import CopyableField from '@/shared/presentation/components/CopyableField';
import { SegmentedTabs, Stack } from '@voltstack/bravais';
import {
    CLUSTER_INSTALL_PLATFORM_OPTIONS,
    buildClusterInstallCommand,
    getDefaultClusterInstallPlatform
} from '@/modules/cluster/utilities/build-cluster-install-command';
import { useMemo, useState } from 'react';
import type { SupportedClusterInstallPlatform } from '@/modules/cluster/utilities/build-cluster-install-command';

interface ClusterInstallCommandPickerProps {
    clusterId: string | null;
    enrollmentToken: string | null;
    className?: string;
};

const ClusterInstallCommandPicker = ({
    clusterId,
    enrollmentToken,
    className = ''
}: ClusterInstallCommandPickerProps) => {
    const [activePlatform, setActivePlatform] = useState<SupportedClusterInstallPlatform>(() => {
        return getDefaultClusterInstallPlatform();
    });

    const installCommand = useMemo(() => {
        if (!clusterId || !enrollmentToken) {
            return '';
        }

        return buildClusterInstallCommand(clusterId, enrollmentToken, activePlatform);
    }, [activePlatform, clusterId, enrollmentToken]);

    return (
        <Stack gap='075' className={`cluster-install-command-picker ${className}`}>
            <SegmentedTabs
                tabs={CLUSTER_INSTALL_PLATFORM_OPTIONS}
                activeTab={activePlatform}
                onChange={(platform) => setActivePlatform(platform)}
                ariaLabel='Cluster host operating system'
                size='sm'
                fullWidth
            />

            <CopyableField
                value={installCommand}
                successMessage='Install command copied'
            />
        </Stack>
    );
};

export default ClusterInstallCommandPicker;
