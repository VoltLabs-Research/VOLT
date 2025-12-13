import { readLargeFile } from '@/utilities/fs';
import { ParseResult, FrameMetadata, ParseOptions } from '@/types/parser';
import { StringScanner } from '@/utilities/string-scanner';

export default abstract class BaseParser{
    protected scanner = new StringScanner();

    // Mutable buffers
    protected positions: Float32Array | null = null;
    protected types: Uint16Array | null = null;
    protected ids: Uint32Array | null = null;
    protected propertyBuffers: { [name: string]: Float32Array } = {};
    protected atomCursor = 0;
    protected parseOptions: ParseOptions = {};

    // Bounding Box state
    protected minX = Infinity;
    protected minY = Infinity;
    protected minZ = Infinity;
    protected maxX = -Infinity;
    protected maxY = -Infinity;
    protected maxZ = -Infinity;

    /**
     * Determines if the parser handles the given file format on the header.
     * @param headerLines First ~100 lines of the file
     */
    abstract canParse(headerLines: string[]): boolean;

    /**
     * Extracts metadata(natoms, bounds) from header to pre-allocate buffers.
     */
    abstract extractMetadata(lines: string[]): FrameMetadata;

    /**
     * Processes a single line inside the 'Atoms' section.
     */
    abstract parseAtomLine(line: string): void;

    /**
     * Determines if a line marks the start or end of the atoms section.
     */
    abstract isAtomSection(line: string, lineIndex: number): boolean;

    public async getHeaderLines(filePath: string): Promise<string[]>{
        const headerLines: string[] = [];

        await readLargeFile(filePath, {
            maxLines: 1000,
            onLine: (line: string) => headerLines.push(line)
        });

        if(!this.canParse(headerLines)){
            throw new Error('FileFormatNotRecognizedByParser');
        }

        return headerLines;
    }

    public async parse(filePath: string, options: ParseOptions = {}): Promise<ParseResult>{
        this.parseOptions = options;
        // Read header to get metadata
        const headerLines = await this.getHeaderLines(filePath);
        let metadata: FrameMetadata | null = null;

        metadata = this.extractMetadata(headerLines);
        this.allocateBuffers(metadata.natoms);

        // Stream full file and parse atoms
        let inAtomsSection = false;
        await readLargeFile(filePath, {
            onLine: (line, idx) => {
                const cleanLine = line.trim();
                if(!cleanLine) return;

                // State machine check
                const sectionStatus = this.isAtomSection(cleanLine, idx);

                // Transition logic could differ per parse, but generally:
                if(sectionStatus && !inAtomsSection){
                    inAtomsSection = true;
                    // Skip the header line itself
                    return;
                }

                if(inAtomsSection){
                    // Safety check to prevent buffer overflow
                    if(this.atomCursor >= metadata!.natoms) return;
                    this.parseAtomLine(cleanLine);
                }
            }
        });

        if(this.atomCursor === 0){
            throw new Error('NoAtomsParsed');
        }

        const result: ParseResult = {
            metadata,
            positions: this.positions!,
            types: this.types!,
            min: [this.minX, this.minY, this.minZ],
            max: [this.maxX, this.maxY, this.maxZ]
        };

        if(this.ids){
            result.ids = this.ids;
        }

        if(Object.keys(this.propertyBuffers).length > 0) {
            result.properties = this.propertyBuffers;
        }

        return result;
    }

    protected allocateBuffers(natoms: number){
        // 1M atoms = ~12MB RAM for coords, ~2MB for types.
        this.positions = new Float32Array(natoms * 3);
        this.types = new Uint16Array(natoms);

        if(this.parseOptions.includeIds){
            this.ids = new Uint32Array(natoms);
        }

        if(this.parseOptions.properties){
            for(const prop of this.parseOptions.properties){
                this.propertyBuffers[prop] = new Float32Array(natoms);
            }
        }

        this.atomCursor = 0;
    }

    protected pushAtom(type: number, x: number, y: number, z: number, id?: number, props?: { [name: string]: number }){
        const idx = this.atomCursor;
        const pidx = idx * 3;
        this.types![idx] = type;
        this.positions![pidx] = x;
        this.positions![pidx + 1] = y;
        this.positions![pidx + 2] = z;

        if(this.ids && id !== undefined){
            this.ids[idx] = id;
        }

        if(props){
            for(const [key, value] of Object.entries(props)) {
                if(this.propertyBuffers[key]){
                    this.propertyBuffers[key][idx] = value;
                }
            }
        }

        // Bounding box update
        if(x < this.minX) this.minX = x;
        if(x > this.maxX) this.maxX = x;
        if(y < this.minY) this.minY = y;
        if(y > this.maxY) this.maxY = y;
        if(z < this.minZ) this.minZ = z;
        if(z > this.maxZ) this.maxZ = z;
        this.atomCursor++;
    }
};
