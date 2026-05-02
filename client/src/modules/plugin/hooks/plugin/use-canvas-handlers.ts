import { useCallback } from 'react';
import type { DragEvent } from 'react';
import type { ReactFlowInstance, Connection, Edge } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';

interface UseCanvasHandlersOptions {
    reactFlowInstance: ReactFlowInstance | null;
}

const useCanvasHandlers = ({ reactFlowInstance }: UseCanvasHandlersOptions) => {
    const addNode = usePluginBuilderStore((state) => state.addNode);
    const validateConnection = usePluginBuilderStore((state) => state.validateConnection);

    const onDragOver = useCallback((event: DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((event: DragEvent) => {
        event.preventDefault();
        const type = event.dataTransfer.getData('application/reactflow') as NodeType;
        if (!type || !reactFlowInstance) return;

        const position = reactFlowInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY
        });
        addNode(type, position);
    }, [reactFlowInstance, addNode]);

    const onDragStart = useCallback((event: DragEvent, nodeType: NodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    }, []);

    const isValidConnection = useCallback((edgeOrConnection: Edge | Connection) => {
        const connection: Connection = {
            source: edgeOrConnection.source,
            target: edgeOrConnection.target,
            sourceHandle: edgeOrConnection.sourceHandle ?? null,
            targetHandle: edgeOrConnection.targetHandle ?? null
        };
        return validateConnection(connection);
    }, [validateConnection]);

    return {
        onDragOver,
        onDrop,
        onDragStart,
        isValidConnection
    };
};

export default useCanvasHandlers;
