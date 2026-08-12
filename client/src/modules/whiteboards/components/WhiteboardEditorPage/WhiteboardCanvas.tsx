import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import { ArrowLeft, ImagePlus } from 'lucide-react';
import type { ClipboardEventHandler, DragEventHandler } from 'react';
import type {
    ExcalidrawAPI,
    ExcalidrawChangeHandler,
    ExcalidrawProps,
    RenderTopRightUI
} from '@/modules/whiteboards/contracts/excalidraw';

interface WhiteboardCanvasProps {
    name: string;
    initialData: ExcalidrawProps['initialData'];
    onChange: ExcalidrawChangeHandler;
    generateIdForFile: ExcalidrawProps['generateIdForFile'];
    renderTopRightUI: RenderTopRightUI;
    onExcalidrawAPI: (api: ExcalidrawAPI) => void;
    onInsertImage: () => void;
    onCanvasPasteCapture: ClipboardEventHandler<HTMLDivElement>;
    onCanvasDragOver: DragEventHandler<HTMLDivElement>;
    onCanvasDrop: DragEventHandler<HTMLDivElement>;
    onBack: () => void;
};

const BackIcon = <ArrowLeft size={16} />;
const InsertImageIcon = <ImagePlus size={16} />;

const WhiteboardCanvas = ({
    name,
    initialData,
    onChange,
    generateIdForFile,
    renderTopRightUI,
    onExcalidrawAPI,
    onInsertImage,
    onCanvasPasteCapture,
    onCanvasDragOver,
    onCanvasDrop,
    onBack
}: WhiteboardCanvasProps) => (
    <div
        className='w-full h-full rounded-xl overflow-hidden'
        onPasteCapture={onCanvasPasteCapture}
        onDragOver={onCanvasDragOver}
        onDrop={onCanvasDrop}
    >
        <Excalidraw
            name={name}
            excalidrawAPI={onExcalidrawAPI}
            initialData={initialData}
            onChange={onChange}
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
