/**
 * Zero-allocation string parser.
 */
export class StringScanner{
    private str: string = '';
    private len: number = 0;
    private cursor: number = 0;

    public load(line: string){
        this.str = line;
        this.len = line.length;
        this.cursor = 0;
    }

    public skipWhitespace(){
        while(this.cursor < this.len && this.str.charCodeAt(this.cursor) <= 32){
            this.cursor++;
        }
    }

    /**
     * Skips N tokens(words/numbers) without parsing them.
     */
    public jump(count: number){
        for(let i = 0; i < count; i++){
            this.skipWhitespace();
            while(this.cursor < this.len && this.str.charCodeAt(this.cursor) > 32){
                this.cursor++;
            }
        }
    }

    public nextInt(): number{
        this.skipWhitespace();
        const start = this.cursor;
        while(this.cursor < this.len && this.str.charCodeAt(this.cursor) > 32){
            this.cursor++;
        }
        return parseInt(this.str.substring(start, this.cursor), 10);
    }

    public nextFloat(): number{
        this.skipWhitespace();
        const start = this.cursor;
        while(this.cursor < this.len && this.str.charCodeAt(this.cursor) > 32){
            this.cursor++;
        }
        return parseFloat(this.str.substring(start, this.cursor));
    }
};
