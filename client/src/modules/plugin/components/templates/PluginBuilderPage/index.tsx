import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import PluginBuilder from '@/modules/plugin/components/organisms/PluginBuilder';
import { usePluginBuilderStore } from '@/modules/plugin/stores/use-plugin-builder-store';
import useLoadPlugin from '@/modules/plugin/hooks/use-load-plugin';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import Loader from '@/shared/presentation/components/Loader';
import AccessDenied from '@/shared/presentation/components/AccessDenied';

const PluginBuilderPage = () => {
    const { searchParams } = useSearchParamsState();
    const pluginId = searchParams.get('id') ?? undefined;

    const clearWorkflow = usePluginBuilderStore((state) => state.clearWorkflow);
    const { isLoading, accessDenied, accessDeniedMessage } = useLoadPlugin(pluginId);

    useEffect(() => {
        if (!pluginId) {
            clearWorkflow();
        }
    }, [pluginId, clearWorkflow]);

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
