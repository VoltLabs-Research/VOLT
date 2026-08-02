type XlsxModule = typeof import('xlsx');

export type SheetExportFormat = 'csv' | 'xlsx';

export type SheetRow = Record<string, string>;

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Excel only honors the delimiter when the file opens with a BOM followed by a sep hint. */
const EXCEL_COMPATIBLE_CSV_PREFIX = '\uFEFFsep=,\r\n';

let xlsxPromise: Promise<XlsxModule> | null = null;

const loadXlsx = (): Promise<XlsxModule> => {
    if (!xlsxPromise) {
        xlsxPromise = import('xlsx').catch((error) => {
            xlsxPromise = null;
            throw error;
        });
    }

    return xlsxPromise;
};

const createWorksheet = async (rows: SheetRow[], columns: string[]) => {
    const xlsx = await loadXlsx();

    return {
        xlsx,
        worksheet: xlsx.utils.json_to_sheet(rows, { header: columns })
    };
};

export const buildSheetTsv = async (rows: SheetRow[], columns: string[]): Promise<string> => {
    const { xlsx, worksheet } = await createWorksheet(rows, columns);
    return xlsx.utils.sheet_to_csv(worksheet, { FS: '\t' });
};

export const buildSheetBlob = async (
    format: SheetExportFormat,
    rows: SheetRow[],
    columns: string[]
): Promise<Blob> => {
    const { xlsx, worksheet } = await createWorksheet(rows, columns);

    if (format === 'csv') {
        const csvContent = xlsx.utils.sheet_to_csv(worksheet).replace(/\r?\n/gu, '\r\n');
        return new Blob([`${EXCEL_COMPATIBLE_CSV_PREFIX}${csvContent}`], { type: 'text/csv;charset=utf-8' });
    }

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const buffer = xlsx.write(workbook, {
        bookType: 'xlsx',
        type: 'array'
    }) as Uint8Array;

    return new Blob([buffer], { type: XLSX_MIME_TYPE });
};
