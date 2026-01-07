/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import * as XLSX from 'xlsx';

export interface ColumnConfig {
    key: string;
    title: string;
}

export interface ExportOptions {
    filename?: string;
    sheetName?: string;
    configuration?: Record<string, any>;
}

/**
 * Export data to an XLSX file and trigger download in the browser
 */
export const exportToXlsx = (
    columns: ColumnConfig[],
    rows: any[],
    options: ExportOptions = {}
): void => {
    const { filename = 'export', sheetName = 'Sheet1', configuration } = options;

    // Create header row from column titles
    const headers = columns.map((col) => col.title);

    // Map data rows using column keys
    const dataRows = rows.map((row) =>
        columns.map((col) => {
            const value = row[col.key];
            // Handle different types of values
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') return JSON.stringify(value);
            return value;
        })
    );

    // Combine headers and data
    const worksheetData = [headers, ...dataRows];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Add Configuration sheet if provided
    if (configuration && Object.keys(configuration).length > 0) {
        const configRows = [['Parameter', 'Value']];
        Object.entries(configuration).forEach(([key, value]) => {
            if (key === 'Analysis Name' || key === 'Modifier' || key === 'Trajectory ID') return;
            configRows.push([
                key,
                typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
            ]);
        });
        const configWorksheet = XLSX.utils.aoa_to_sheet(configRows);
        XLSX.utils.book_append_sheet(workbook, configWorksheet, 'Configuration');
    }

    // Generate file and trigger download
    const xlsxFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(workbook, xlsxFilename);
};

export default exportToXlsx;
