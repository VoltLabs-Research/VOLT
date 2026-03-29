import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import { ArrowLeft, ImagePlus } from 'lucide-react';
import type { ComponentProps } from 'react';
import type { DragEventHandler } from 'react';

type ExcalidrawProps = ComponentProps<typeof Excalidraw>;
type ExcalidrawAPICallback = NonNullable<ExcalidrawProps['excalidrawAPI']>;
type ExcalidrawAPI = Parameters<ExcalidrawAPICallback>[0];
type ExcalidrawChangeHandler = NonNullable<ExcalidrawProps['onChange']>;
type RenderTopRightUI = NonNullable<ExcalidrawProps['renderTopRightUI']>;

export interface WhiteboardCanvasProps {
    name: string;
    initialData: ExcalidrawProps['initialData'];
    onChange: ExcalidrawChangeHandler;
    onPaste: ExcalidrawProps['onPaste'];
    generateIdForFile: ExcalidrawProps['generateIdForFile'];
    renderTopRightUI: RenderTopRightUI;
    onExcalidrawAPI: (api: ExcalidrawAPI) => void;
    onInsertImage: () => void;
    onCanvasDragOver: DragEventHandler<HTMLDivElement>;
    onCanvasDrop: DragEventHandler<HTMLDivElement>;
    onBack: () => void;
};

const BackIcon = <ArrowLeft size={16} />;
const InsertImageIcon = <ImagePlus size={16} />;

/**
 * Thin wrapper that co-locates Excalidraw and MainMenu in the same
 * dynamic chunk. Must be imported via React.lazy() to keep the large
 * Excalidraw bundle out of the initial JS payload.
 */
const WhiteboardCanvas = ({
    name,
    initialData,
    onChange,
    onPaste,
    generateIdForFile,
    renderTopRightUI,
    onExcalidrawAPI,
    onInsertImage,
    onCanvasDragOver,
    onCanvasDrop,
    onBack
}: WhiteboardCanvasProps) => (
    <div className='whiteboard-canvas-shell' onDragOver={onCanvasDragOver} onDrop={onCanvasDrop}>
        <Excalidraw
            name={name}
            excalidrawAPI={onExcalidrawAPI}
            initialData={initialData}
            onChange={onChange}
            onPaste={onPaste}
            generateIdForFile={generateIdForFile}
            renderTopRightUI={renderTopRightUI}
            UIOptions={{
                tools: {
                    image: false
                }
            }}
        >
            <MainMenu>
                <MainMenu.Item icon={BackIcon} onSelect={onBack}>
                    Back to Whiteboards
                </MainMenu.Item>
                <MainMenu.Item icon={InsertImageIcon} onSelect={onInsertImage}>
                    Insert image
                </MainMenu.Item>
                <MainMenu.Separator />
                <MainMenu.DefaultItems.SaveAsImage />
                <MainMenu.DefaultItems.ClearCanvas />
                <MainMenu.DefaultItems.ToggleTheme />
                <MainMenu.DefaultItems.ChangeCanvasBackground />
            </MainMenu>
        </Excalidraw>
    </div>
);

export default WhiteboardCanvas;
