import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import Button from './Button';
import clsx from 'clsx';

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  example?: string;
}

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: Record<string, string>[]) => Promise<{ success: number; errors: string[] }>;
  fields: ImportField[];
  title: string;
  templateFileName?: string;
}

export default function ImportModal({
  isOpen,
  onClose,
  onImport,
  fields,
  title,
  templateFileName = 'template',
}: ImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setResult(null);
    setParseError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const parseFile = async (file: File) => {
    setParseError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      let data: Record<string, string>[] = [];

      if (ext === 'csv') {
        const text = await file.text();
        const result = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim().toLowerCase(),
        });
        data = result.data;
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        data = jsonData.map((row) => {
          const newRow: Record<string, string> = {};
          Object.entries(row).forEach(([key, value]) => {
            newRow[key.trim().toLowerCase()] = String(value);
          });
          return newRow;
        });
      } else {
        setParseError('Nieobsługiwany format pliku. Użyj CSV lub XLSX.');
        return;
      }

      if (data.length === 0) {
        setParseError('Plik jest pusty lub ma nieprawidłowy format.');
        return;
      }

      // Map columns to expected fields
      const mappedData = data.map((row) => {
        const mappedRow: Record<string, string> = {};
        fields.forEach((field) => {
          const key = field.key.toLowerCase();
          const value = row[key] || row[field.label.toLowerCase()] || '';
          mappedRow[field.key] = String(value).trim();
        });
        return mappedRow;
      });

      // Validate required fields
      const missingRequired = fields
        .filter((f) => f.required)
        .filter((f) => !mappedData.some((row) => row[f.key]));

      if (missingRequired.length > 0) {
        setParseError(
          `Brak wymaganych kolumn: ${missingRequired.map((f) => f.label).join(', ')}`
        );
        return;
      }

      setParsedData(mappedData);
      setFile(file);
    } catch (error) {
      setParseError('Błąd parsowania pliku. Sprawdź format danych.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      parseFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      parseFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    setImporting(true);
    try {
      const importResult = await onImport(parsedData);
      setResult(importResult);
    } catch (error: any) {
      setResult({ success: 0, errors: [error.message || 'Błąd importu'] });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = fields.map((f) => f.key);
    const exampleRow = fields.map((f) => f.example || '');
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${templateFileName}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative glass-card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-white mb-4">{title}</h2>

        {!result ? (
          <>
            {/* Template download */}
            <div className="mb-4">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300"
              >
                <Download className="w-4 h-4" />
                Pobierz szablon XLSX
              </button>
            </div>

            {/* Expected columns info */}
            <div className="mb-4 p-3 bg-white/5 rounded-lg">
              <div className="text-xs text-slate-400 mb-2">Wymagane kolumny:</div>
              <div className="flex flex-wrap gap-1">
                {fields.map((f) => (
                  <span
                    key={f.key}
                    className={clsx(
                      'px-2 py-0.5 rounded text-xs',
                      f.required
                        ? 'bg-primary-500/20 text-primary-400'
                        : 'bg-slate-500/20 text-slate-400'
                    )}
                  >
                    {f.label}
                    {f.required && ' *'}
                  </span>
                ))}
              </div>
            </div>

            {/* Drop zone */}
            {!file ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={clsx(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                  isDragging
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-white/20 hover:border-white/40'
                )}
              >
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-white font-medium mb-1">
                  Przeciągnij plik lub kliknij
                </p>
                <p className="text-sm text-slate-400">CSV, XLSX, XLS</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                {/* File info */}
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                  <FileSpreadsheet className="w-8 h-8 text-green-400" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">{file.name}</div>
                    <div className="text-sm text-slate-400">
                      {parsedData.length} rekordów
                    </div>
                  </div>
                  <button
                    onClick={resetState}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Preview table */}
                {parsedData.length > 0 && (
                  <div className="overflow-x-auto">
                    <div className="text-xs text-slate-400 mb-2">
                      Podgląd (pierwsze 5 rekordów):
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/10">
                          {fields.map((f) => (
                            <th
                              key={f.key}
                              className="px-2 py-1 text-left text-slate-400 font-medium"
                            >
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-b border-white/5">
                            {fields.map((f) => (
                              <td key={f.key} className="px-2 py-1 text-white truncate max-w-[150px]">
                                {row[f.key] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {parseError && (
              <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {parseError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-6">
              <Button variant="secondary" onClick={handleClose} className="flex-1">
                Anuluj
              </Button>
              <Button
                onClick={handleImport}
                disabled={parsedData.length === 0}
                loading={importing}
                className="flex-1"
              >
                Importuj ({parsedData.length})
              </Button>
            </div>
          </>
        ) : (
          /* Results */
          <div className="space-y-4">
            <div className="text-center py-4">
              {result.errors.length === 0 ? (
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-3" />
              ) : (
                <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-3" />
              )}
              <p className="text-lg font-medium text-white">
                Zaimportowano: {result.success}
              </p>
              {result.errors.length > 0 && (
                <p className="text-sm text-red-400">
                  Błędów: {result.errors.length}
                </p>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto bg-red-500/10 rounded-lg p-3">
                <div className="text-xs text-red-400 space-y-1">
                  {result.errors.slice(0, 20).map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                  {result.errors.length > 20 && (
                    <div>...i {result.errors.length - 20} więcej</div>
                  )}
                </div>
              </div>
            )}

            <Button onClick={handleClose} className="w-full">
              Zamknij
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
