import useContainerDetailsContext from '../../hooks/use-container-details-context';
import ContainerOverview from '../ContainerOverview';

const ContainerOverviewPage = () => {
    const { container, stats, onUpdateEnv, onUpdatePorts } = useContainerDetailsContext();

    return (
        <ContainerOverview
            container={container}
            stats={stats}
            onUpdateEnv={onUpdateEnv}
            onUpdatePorts={onUpdatePorts}
        />
    );
};

export default ContainerOverviewPage;
