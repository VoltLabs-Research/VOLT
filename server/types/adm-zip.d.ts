declare module 'adm-zip' {
  class AdmZip{
    constructor(file?: string | Buffer);
    addLocalFile(localPath: string, zipPath?: string, zipName?: string): void;
    addFile(entryName: string, content: Buffer, comment?: string): void;
    toBuffer(): Buffer;
  }
  export = AdmZip;
}
