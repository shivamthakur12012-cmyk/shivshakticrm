import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle,
  XCircle, ArrowRight, RefreshCw, Layers, FileText, Info
} from 'lucide-react';

export const BulkUpload: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, organizations, activeOrganizationId } = useAuthStore();
  const activeOrg = organizations.find(org => org.id === activeOrganizationId) || organizations[0];
  const activeRole = activeOrg?.role || (user?.email === 'shivamthakur12012@gmail.com' ? 'Admin' : 'Sale Executive');
  const isAdmin = ['Admin', 'Super Admin'].includes(activeRole) || user?.email === 'shivamthakur12012@gmail.com';
  const isManager = isAdmin || activeRole === 'Manager';
  const isTeamLeader = isManager || activeRole === 'Team Leader';
  const isPrivileged = isTeamLeader;

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<{ [key: string]: string }>({
    Name: 'name',
    Company: 'company',
    Phone: 'phone',
    Email: 'email',
    Source: 'source',
    ServiceInterested: 'serviceInterested',
    Notes: 'notes'
  });
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'preview' | 'create_new'>('preview');
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'result'>('upload');
  const [importResult, setImportResult] = useState<any>(null);

  // Fetch past 30-day import logs
  const { data: importLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['lead-import-logs'],
    queryFn: async () => {
      const res = await api.get('/leads/import-logs');
      return res.data.data;
    },
    enabled: isPrivileged
  });

  if (!isPrivileged) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black text-slate-800 dark:text-white">Access Restricted</h2>
        <p className="text-xs text-slate-500 dark:text-dark-400 max-w-md mx-auto">
          Bulk Lead Upload and CSV Import functions are restricted to Admins and Managers. Standard employees can only manage their assigned leads.
        </p>
        <Link
          to="/crm/leads"
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold text-xs transition shadow-md shadow-red-500/20 active:scale-95"
        >
          <span>Back to My Assigned Leads</span>
        </Link>
      </div>
    );
  }

  // Download sample template
  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/leads/bulk-template', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'leads_bulk_template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      // Fallback: generate and download client-side template
      const csvContent =
        'Name,Company,Phone,Email,Source,ServiceInterested,ExpectedValue,Notes\n' +
        'Rahul Sharma,Apex Enterprises,9876543210,rahul@apex.com,IndiaMART,Business Loan,150000,Interested in quick sanction\n' +
        'Priya Patel,Innovatech Solutions,9811223344,priya@innovatech.com,JustDial,GST Registration,25000,Requires filing assistance\n' +
        'Vikram Malhotra,Malhotra Logistics,9822334455,vikram@malhotra.com,Website,ISO Certification,50000,Needs compliance quote\n';

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'leads_bulk_template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  };

  // File selection & robust CSV parser (handles UTF-8 BOM, quoted fields, \r\n, auto-detection)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.endsWith('.csv') && !selected.name.endsWith('.xlsx')) {
      alert('Please upload a valid .csv or .xlsx file.');
      return;
    }

    setFile(selected);

    // Parse CSV
    const reader = new FileReader();
    reader.onload = (event) => {
      let text = event.target?.result as string;
      if (!text) return;

      // Strip UTF-8 Byte Order Mark (BOM) if present
      text = text.replace(/^\uFEFF/, '').trim();

      // Robust CSV line parser handling quotes and commas
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' || char === "'") {
            if (inQuotes && line[i + 1] === char) {
              cur += char;
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        alert('The uploaded file must contain at least a header row and one data row.');
        return;
      }

      const headers = parseCSVLine(lines[0]).map(h => h.replace(/^["']|["']$/g, '').trim());
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]).map(v => v.replace(/^["']|["']$/g, '').trim());
        const rowObj: any = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] !== undefined ? values[idx] : '';
        });
        rows.push(rowObj);
      }

      // Auto-detect column mappings based on header names
      const newMapping: { [key: string]: string } = {};
      headers.forEach(h => {
        const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (/^(name|fullname|leadname|clientname|customername|contactname|person|client)$/.test(lower)) {
          newMapping[h] = 'name';
        } else if (/^(phone|phonenumber|mobile|mobilenumber|contact|cell|telephone|whatsapp)$/.test(lower)) {
          newMapping[h] = 'phone';
        } else if (/^(email|emailaddress|mail|emailid)$/.test(lower)) {
          newMapping[h] = 'email';
        } else if (/^(company|companyname|organization|org|business|firm)$/.test(lower)) {
          newMapping[h] = 'company';
        } else if (/^(source|leadsource|channel|platform)$/.test(lower)) {
          newMapping[h] = 'source';
        } else if (/^(service|serviceinterested|product|productinterested|requirement|inquiry)$/.test(lower)) {
          newMapping[h] = 'serviceInterested';
        } else if (/^(notes|note|remarks|comments|description)$/.test(lower)) {
          newMapping[h] = 'notes';
        } else {
          newMapping[h] = '';
        }
      });

      setColumnMapping(newMapping);
      setParsedRows(rows);
      setStep('mapping');
    };

    reader.readAsText(selected);
  };

  // Submit bulk upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      // Map rows based on column mapping with auto-fallback
      const mappedRows = parsedRows.map(row => {
        const item: any = {};
        Object.entries(columnMapping).forEach(([fileCol, targetKey]) => {
          if (targetKey && row[fileCol] !== undefined) {
            item[targetKey] = row[fileCol];
          }
        });

        // Fallback: if name or phone wasn't mapped, try to auto-extract from row
        if (!item.name) {
          const nameKey = Object.keys(row).find(k => /name|client|customer|person/i.test(k));
          if (nameKey && row[nameKey]) item.name = row[nameKey];
        }
        if (!item.phone) {
          const phoneKey = Object.keys(row).find(k => /phone|mobile|contact|cell/i.test(k));
          if (phoneKey && row[phoneKey]) item.phone = row[phoneKey];
        }
        if (!item.email) {
          const emailKey = Object.keys(row).find(k => /email|mail/i.test(k));
          if (emailKey && row[emailKey]) item.email = row[emailKey];
        }
        if (!item.company) {
          const companyKey = Object.keys(row).find(k => /company|org|firm|business/i.test(k));
          if (companyKey && row[companyKey]) item.company = row[companyKey];
        }

        return item;
      });

      const res = await api.post('/leads/bulk-upload', {
        rows: mappedRows,
        fileName: file?.name || 'leads_upload.csv',
        fileSize: file?.size || 0,
        duplicateStrategy
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setImportResult(data);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-import-logs'] });
    }
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-6 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-800 dark:text-white flex items-center space-x-2">
            <FileSpreadsheet className="h-6 w-6 text-primary-600" />
            <span>Bulk Excel / CSV Lead Import</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-dark-400 mt-1">
            Import hundreds of leads simultaneously with locked header mapping, row-by-row validation, and duplicate detection.
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-dark-200 font-bold text-xs transition"
        >
          <Download className="h-4 w-4 text-primary-500" />
          <span>Download Standard Template (.CSV)</span>
        </button>
      </div>

      {/* Workflow Step Tracker */}
      <div className="grid grid-cols-4 gap-2 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 p-2 rounded-2xl">
        {[
          { id: 'upload', name: '1. Select File' },
          { id: 'mapping', name: '2. Column Mapping' },
          { id: 'preview', name: '3. Duplicate & Options' },
          { id: 'result', name: '4. Import Summary' }
        ].map(s => (
          <div
            key={s.id}
            className={`py-2 px-3 text-center rounded-xl text-xs font-bold transition ${step === s.id
                ? 'bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] text-white shadow-md shadow-red-500/20'
                : 'text-slate-400 dark:text-dark-500'
              }`}
          >
            {s.name}
          </div>
        ))}
      </div>

      {/* STEP 1: UPLOAD BOX */}
      {step === 'upload' && (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-8 shadow-sm">
          <div className="border-2 border-dashed border-slate-300 dark:border-dark-700 hover:border-primary-500 dark:hover:border-primary-500 rounded-2xl p-12 text-center transition flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 flex items-center justify-center">
              <Upload className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-white">
                Drag and drop your Excel / CSV file here, or click to browse
              </p>
              <p className="text-xs text-slate-400 dark:text-dark-500 mt-1">
                Supported formats: .CSV, .XLSX (Max file size: 10MB)
              </p>
            </div>
            <label className="cursor-pointer px-5 py-2.5 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold text-xs transition shadow-md shadow-red-500/20 active:scale-95">
              Choose File
              <input type="file" accept=".csv, .xlsx" onChange={handleFileChange} className="hidden" />
            </label>
          </div>

          <div className="mt-6 flex items-start space-x-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-700 dark:text-blue-300">
            <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Required Columns in CSV:</p>
              <p className="mt-0.5 text-[11px] text-blue-600 dark:text-blue-400">
                • <strong>Name</strong> (mandatory) • <strong>Phone</strong> (mandatory 10-digit number) • <strong>Email</strong> (optional) • <strong>Source</strong> (Website, WhatsApp, JustDial, IndiaMART, etc.) • <strong>ServiceInterested</strong> • <strong>Notes</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: COLUMN MAPPING */}
      {step === 'mapping' && (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-white">Verify Column Mapping</h2>
              <p className="text-xs text-slate-400">File: {file?.name} ({parsedRows.length} rows detected)</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-dark-300 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
              >
                Change File
              </button>
              <button
                onClick={() => setStep('preview')}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white font-bold text-xs transition shadow-md shadow-red-500/20 active:scale-95"
              >
                <span>Continue to Preview</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.keys(parsedRows[0] || {}).map((fileCol) => (
              <div key={fileCol} className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-800/40 border border-slate-200 dark:border-dark-700 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-white">{fileCol}</p>
                  <p className="text-[11px] text-slate-400 truncate max-w-[180px]">
                    Sample: {parsedRows[0]?.[fileCol] || '(blank)'}
                  </p>
                </div>
                <select
                  value={columnMapping[fileCol] || ''}
                  onChange={(e) => setColumnMapping({ ...columnMapping, [fileCol]: e.target.value })}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-dark-600 bg-white dark:bg-dark-900 text-xs font-semibold text-slate-800 dark:text-white outline-none"
                >
                  <option value="">-- Ignore Column --</option>
                  <option value="name">Name (Required)</option>
                  <option value="phone">Phone (Required)</option>
                  <option value="email">Email</option>
                  <option value="company">Company</option>
                  <option value="source">Source</option>
                  <option value="serviceInterested">Service Interested</option>
                  <option value="notes">Notes</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW & DUPLICATE STRATEGY */}
      {step === 'preview' && (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-white">Duplicate Resolution & Import Confirmation</h2>
              <p className="text-xs text-slate-400">Review sample rows before committing to database.</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setStep('mapping')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-dark-300 hover:bg-slate-100 dark:hover:bg-dark-800 transition"
              >
                Back
              </button>
              <button
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending}
                className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-md disabled:opacity-50"
              >
                {uploadMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span>{uploadMutation.isPending ? 'Processing Batch...' : `Execute Import (${parsedRows.length} rows)`}</span>
              </button>
            </div>
          </div>

          {/* Duplicate Strategy Option */}
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
            <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Duplicate Handling Strategy (Matched on Phone / Email)</span>
            </h3>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <label className={`p-3 rounded-xl border cursor-pointer text-xs transition ${duplicateStrategy === 'preview' ? 'border-amber-500 bg-white dark:bg-dark-900 font-bold text-amber-900 dark:text-white shadow-sm' : 'border-amber-200 dark:border-dark-700 text-slate-600 dark:text-dark-400'}`}>
                <input type="radio" name="dup" value="preview" checked={duplicateStrategy === 'preview'} onChange={() => setDuplicateStrategy('preview')} className="hidden" />
                <p className="font-bold">Flag & Review (Recommended)</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Flags duplicates in report without overwriting.</p>
              </label>
              <label className={`p-3 rounded-xl border cursor-pointer text-xs transition ${duplicateStrategy === 'skip' ? 'border-amber-500 bg-white dark:bg-dark-900 font-bold text-amber-900 dark:text-white shadow-sm' : 'border-amber-200 dark:border-dark-700 text-slate-600 dark:text-dark-400'}`}>
                <input type="radio" name="dup" value="skip" checked={duplicateStrategy === 'skip'} onChange={() => setDuplicateStrategy('skip')} className="hidden" />
                <p className="font-bold">Skip Silently</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Skips existing records and imports only new.</p>
              </label>
              <label className={`p-3 rounded-xl border cursor-pointer text-xs transition ${duplicateStrategy === 'create_new' ? 'border-amber-500 bg-white dark:bg-dark-900 font-bold text-amber-900 dark:text-white shadow-sm' : 'border-amber-200 dark:border-dark-700 text-slate-600 dark:text-dark-400'}`}>
                <input type="radio" name="dup" value="create_new" checked={duplicateStrategy === 'create_new'} onChange={() => setDuplicateStrategy('create_new')} className="hidden" />
                <p className="font-bold">Create Anyway</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Creates new separate lead entry for every row.</p>
              </label>
            </div>
          </div>

          {/* Sample Rows Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-dark-800 rounded-2xl">
            <table className="w-full text-left text-xs text-slate-600 dark:text-dark-300">
              <thead className="bg-slate-50 dark:bg-dark-800 font-bold text-slate-700 dark:text-white uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Company</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Service</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
                {parsedRows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-dark-800/30">
                    <td className="p-3 text-slate-400">{i + 1}</td>
                    <td className="p-3 font-bold text-slate-800 dark:text-white">{r[Object.keys(columnMapping).find(k => columnMapping[k] === 'name') || 'Name'] || '—'}</td>
                    <td className="p-3">{r[Object.keys(columnMapping).find(k => columnMapping[k] === 'company') || 'Company'] || '—'}</td>
                    <td className="p-3 font-semibold text-primary-600">{r[Object.keys(columnMapping).find(k => columnMapping[k] === 'phone') || 'Phone'] || '—'}</td>
                    <td className="p-3">{r[Object.keys(columnMapping).find(k => columnMapping[k] === 'email') || 'Email'] || '—'}</td>
                    <td className="p-3">{r[Object.keys(columnMapping).find(k => columnMapping[k] === 'source') || 'Source'] || 'Website'}</td>
                    <td className="p-3">{r[Object.keys(columnMapping).find(k => columnMapping[k] === 'serviceInterested') || 'ServiceInterested'] || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 4: IMPORT RESULT REPORT */}
      {step === 'result' && importResult && (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-dark-800 pb-4">
            <h2 className="text-base font-black text-slate-800 dark:text-white flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span>Import Execution Summary</span>
            </h2>
            <button
              onClick={() => { setStep('upload'); setFile(null); setParsedRows([]); setImportResult(null); }}
              className="px-4 py-2 rounded-xl bg-[linear-gradient(45deg,#ef4444_0%,#6366f1_50%,#2563eb_100%)] hover:opacity-95 text-white text-xs font-bold transition shadow-md shadow-red-500/20 active:scale-95"
            >
              Upload Another Batch
            </button>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-800/50 border border-slate-200 dark:border-dark-700 text-center">
              <p className="text-[10px] uppercase font-bold text-slate-400">Total Rows</p>
              <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">{importResult.totalRows}</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-center">
              <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Successful</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{importResult.successfulCount}</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-center">
              <p className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Duplicates Flagged</p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{importResult.duplicateCount}</p>
            </div>
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-center">
              <p className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400">Failed Rows</p>
              <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{importResult.failedCount}</p>
            </div>
          </div>

          {/* Errors Table if any */}
          {importResult.errors && importResult.errors.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center space-x-1.5">
                <XCircle className="h-4 w-4" />
                <span>Failed Rows Breakdown</span>
              </h3>
              <div className="border border-red-200 dark:border-red-900/40 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 font-bold text-[10px] uppercase">
                    <tr>
                      <th className="p-3">Row #</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Error Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 dark:divide-red-900/20">
                    {importResult.errors.map((err: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-3 font-bold text-red-600">Row {err.rowNumber}</td>
                        <td className="p-3">{err.name || '—'}</td>
                        <td className="p-3">{err.phone || '—'}</td>
                        <td className="p-3 text-red-600 font-medium">{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 30-Day Upload Log History Table */}
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-800 rounded-3xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center space-x-2">
          <Layers className="h-4 w-4 text-primary-500" />
          <span>Upload Archive & Import History (30-Day Retention)</span>
        </h2>

        {isLoadingLogs ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading import logs...</div>
        ) : !importLogs || importLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">No past uploads found.</div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-dark-800 rounded-2xl">
            <table className="w-full text-left text-xs text-slate-600 dark:text-dark-300">
              <thead className="bg-slate-50 dark:bg-dark-800 text-slate-700 dark:text-white font-bold text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">File Name</th>
                  <th className="p-3">Imported By</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Success</th>
                  <th className="p-3">Duplicates</th>
                  <th className="p-3">Failed</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-800">
                {importLogs.map((log: any) => (
                  <tr key={log._id} className="hover:bg-slate-50/50 dark:hover:bg-dark-800/30">
                    <td className="p-3 text-slate-400">{new Date(log.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="p-3 font-bold text-slate-800 dark:text-white flex items-center space-x-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary-500" />
                      <span>{log.fileName}</span>
                    </td>
                    <td className="p-3">{log.importedBy ? `${log.importedBy.firstName} ${log.importedBy.lastName}` : 'Admin'}</td>
                    <td className="p-3 font-semibold">{log.totalRows}</td>
                    <td className="p-3 font-bold text-emerald-600">{log.successfulRows}</td>
                    <td className="p-3 font-bold text-amber-600">{log.duplicateRows}</td>
                    <td className="p-3 font-bold text-red-600">{log.failedRows}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold text-[10px]">
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
