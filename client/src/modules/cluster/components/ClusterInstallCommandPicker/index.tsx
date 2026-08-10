import { cn } from '@heroui/react';
import './ClusterInstallCommandPicker.css';
import CopyableField from '@/shared/ui/components/CopyableField';
import { SegmentedTabs } from '@voltstack/bravais';
import {
    CLUSTER_INSTALL_PLATFORM_OPTIONS,
    ClusterInstallPlatform,
    buildClusterInstallCommand,
    getDefaultClusterInstallPlatform
} from '@/modules/cluster/utils/build-cluster-install-command';
import { useMemo, useState } from 'react';

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
    const [activePlatform, setActivePlatform] = useState<ClusterInstallPlatform>(getDefaultClusterInstallPlatform);

    const installCommand = useMemo(() => {
        if (!clusterId || !enrollmentToken) {
            return '';
        }

        return buildClusterInstallCommand(clusterId, enrollmentToken, activePlatform);
    }, [activePlatform, clusterId, enrollmentToken]);

    return (
        <div className={cn('flex flex-col gap-3', `cluster-install-command-picker ${className}`)}>
            <SegmentedTabs
                tabs={CLUSTER_INSTALL_PLATFORM_OPTIONS}
                activeTab={activePlatform}
                onChange={setActivePlatform}
                ariaLabel='Cluster host operating system'
                size='sm'
                fullWidth
            />

            <CopyableField
                value={installCommand}
                successMessage='Install command copied'
            />
        </div>
    );
};

export default ClusterInstallCommandPicker;
