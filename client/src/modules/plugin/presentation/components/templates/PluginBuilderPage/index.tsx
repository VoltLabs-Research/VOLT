import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import PluginBuilder from '../../organisms/PluginBuilder';
import usePluginBuilderStore from '../../../stores/use-plugin-builder-store';
import useLoadPlugin from '../../../hooks/use-load-plugin';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import Loader from '@/shared/presentation/components/Loader';
import AccessDenied from '@/shared/presentation/components/AccessDenied';

const PluginBuilderPage = () => {
    const { searchParams } = useSearchParamsState();
    const pluginId = searchParams.get('id');

    const clearWorkflow = usePluginBuilderStore((state) => state.clearWorkflow);
    const isLoading = usePluginBuilderStore((state) => state.isLoading);
    const { loadPlugin, accessDenied, accessDeniedMessage } = useLoadPlugin();

    useEffect(() => {
        if (pluginId) {
            loadPlugin(pluginId);
        } else {
            clearWorkflow();
        }
    }, [pluginId, loadPlugin, clearWorkflow]);

    useEffect(() => {
        return () => {
            clearWorkflow();
        };
    }, [clearWorkflow]);

    if (accessDenied) {
        return <AccessDenied description={accessDeniedMessage} />;
    }

    if (isLoading) {
        return <Loader scale={0.8} />;
    }

    return (
        <ReactFlowProvider>
            <PluginBuilder />
        </ReactFlowProvider>
    );
};

export default PluginBuilderPage;
