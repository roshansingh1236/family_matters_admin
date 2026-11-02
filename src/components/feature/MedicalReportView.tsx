import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { GC_MEDICAL_SCREENING_STATUSES } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultStatus = 'negative' | 'positive' | 'normal' | 'abnormal' | 'pending' | 'cleared' | 'not_done';

interface LabRow {
  test: string;
  result: string;
  status: ResultStatus;
  note?: string;
}

interface MedicalSection {
  title: string;
  icon: string;
  color: string;
  rows: { label: string; value: string | null | undefined }[];
}

interface MedicalReportViewProps {
  userType: 'surrogate' | 'parent';
  data: any;
  name: string;
  userId?: string;
  screeningStatus?: string;
  onUpdateScreeningStatus?: (status: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Imported from types — GC_MEDICAL_SCREENING_STATUSES

const INFECTIOUS_RESULT_MAP: Record<string, ResultStatus> = {
  negative: 'negative',
  non_reactive: 'negative',
  'non-reactive': 'negative',
  nr: 'negative',
  positive: 'positive',
  reactive: 'positive',
  r: 'positive',
  normal: 'normal',
  abnormal: 'abnormal',
  pending: 'pending',
  cleared: 'cleared',
};

function inferStatus(val: string | undefined | null): ResultStatus {
  if (!val || val.trim() === '' || val === '—') return 'pending';
  const lower = val.toLowerCase().trim();
  return INFECTIOUS_RESULT_MAP[lower] ?? 'pending';
}

// ─── Sub-components ────────────────────────────────────────────────────────────

const ResultBadge: React.FC<{ status: ResultStatus; label?: string }> = ({ status, label }) => {
  const map: Record<ResultStatus, { cls: string; icon: string; text: string }> = {
    negative: { cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20', icon: 'ri-checkbox-circle-fill', text: 'Negative' },
    normal: { cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20', icon: 'ri-checkbox-circle-fill', text: 'Normal' },
    cleared: { cls: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400 border-teal-200 dark:border-teal-500/20', icon: 'ri-shield-check-fill', text: 'Cleared' },
    positive: { cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20', icon: 'ri-close-circle-fill', text: 'Positive' },
    abnormal: { cls: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border-orange-200 dark:border-orange-500/20', icon: 'ri-alert-fill', text: 'Abnormal' },
    pending: { cls: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400 border-gray-200 dark:border-white/10', icon: 'ri-time-line', text: 'Pending' },
    not_done: { cls: 'bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500 border-gray-200 dark:border-white/10', icon: 'ri-minus-circle-line', text: 'Not Done' },
  };
  const { cls, icon, text } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      <i className={`${icon} text-[11px]`}></i>
      {label ?? text}
    </span>
  );
};

const FieldRow: React.FC<{ label: string; value: string | null | undefined; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex items-start justify-between py-2.5 border-b border-gray-100 dark:border-white/5 last:border-0">
    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-40 flex-shrink-0">{label}</span>
    <span className={`text-sm text-gray-900 dark:text-white text-right flex-1 ${mono ? 'font-mono' : ''}`}>
      {value && value.trim() !== '' ? value : <span className="text-gray-300 dark:text-white/20">—</span>}
    </span>
  </div>
);

const LabTestRow: React.FC<{ row: LabRow }> = ({ row }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-white/5 last:border-0">
    <div className="flex-1">
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.test}</p>
      {row.note && <p className="text-xs text-gray-400 mt-0.5">{row.note}</p>}
    </div>
    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
      {row.result && row.result !== '—' && (
        <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{row.result}</span>
      )}
      <ResultBadge status={row.status} />
    </div>
  </div>
);

const DocumentPreviewModal: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const isPdf = url.toLowerCase().split('?')[0].endsWith('.pdf');

  // Lock body scroll
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-6xl h-full bg-white dark:bg-[#15111f] rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#15111f]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <i className={isPdf ? "ri-file-pdf-line text-xl" : "ri-image-line text-xl"}></i>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Document Preview</h3>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">{isPdf ? 'PDF Document' : 'Image File'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isPdf && (
              <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl text-xs border border-gray-200 dark:border-white/5">
                <button
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                  className="p-1.5 hover:bg-white dark:hover:bg-white/10 rounded-lg transition-colors text-gray-500 dark:text-white/60"
                >
                  <i className="ri-zoom-out-line text-base"></i>
                </button>
                <span className="px-2 font-mono font-bold text-gray-900 dark:text-white w-12 text-center">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                  className="p-1.5 hover:bg-white dark:hover:bg-white/10 rounded-lg transition-colors text-gray-500 dark:text-white/60"
                >
                  <i className="ri-zoom-in-line text-base"></i>
                </button>
              </div>
            )}

            <a
              href={url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all"
            >
              <i className="ri-download-2-line"></i> Download
            </a>

            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-400 dark:text-white/40 dark:hover:text-white"
            >
              <i className="ri-close-line text-2xl"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-black/40 flex items-center justify-center p-4 sm:p-12">
          {isPdf ? (
            <iframe
              src={`${url}#toolbar=0`}
              className="w-full h-full rounded-xl border border-gray-200 dark:border-white/10 shadow-lg bg-white"
            />
          ) : (
            <div
              className="transition-transform duration-200 ease-out"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            >
              <img
                src={url}
                alt="Preview"
                className="max-w-full max-h-[70vh] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 bg-white"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DocumentLinks: React.FC<{ urls?: string | string[] | any; label: string; onPreview: (url: string) => void }> = ({ urls, label, onPreview }) => {
  const normalizedUrls = Array.isArray(urls) ? urls : (typeof urls === 'string' ? [urls] : []);
  if (normalizedUrls.length === 0) return null;
  return (
    <div className="py-2.5 border-b border-gray-100 dark:border-white/5 last:border-0">
      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-400 mb-2.5">{label}</p>
      <div className="flex flex-wrap gap-2.5">
        {normalizedUrls.map((url, i) => {
          if (typeof url !== 'string' || !url.startsWith('http')) return null;
          const isPdf = url.toLowerCase().split('?')[0].endsWith('.pdf');
          return (
            <button
              key={i}
              onClick={() => onPreview(url)}
              className="group inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-500/30 transition-all text-left"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPdf ? 'bg-red-50 dark:bg-red-500/10 text-red-500' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-500'}`}>
                <i className={isPdf ? "ri-file-pdf-line text-base" : "ri-image-line text-base"}></i>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-900 dark:text-white leading-none">Report {i + 1}</p>
                <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-tighter">Click to Preview</p>
              </div>
              <div className="ml-2 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-gray-50 dark:bg-white/10 transition-opacity">
                <i className="ri-eye-line text-xs text-blue-500"></i>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SectionCard: React.FC<{
  title: string;
  icon: string;
  accentColor: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}> = ({ title, icon, accentColor, children, badge }) => (
  <div className="bg-white dark:bg-[#15111f] rounded-2xl border border-rose-100/60 dark:border-white/5 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
    <div className={`flex items-center justify-between px-5 py-3.5 border-b border-rose-100/60 dark:border-white/5 bg-gradient-to-r ${accentColor}`}>
      <div className="flex items-center gap-2.5">
        <i className={`${icon} text-base`}></i>
        <span className="text-sm font-bold tracking-wide">{title}</span>
      </div>
      {badge}
    </div>
    <div className="px-5 py-1">{children}</div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MedicalReportView({
  userType,
  data,
  name,
  userId,
  screeningStatus,
  onUpdateScreeningStatus,
}: MedicalReportViewProps) {
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState(screeningStatus ?? 'Not Started');
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      const el = reportRef.current;
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableW = pageW - margin * 2;
      const imgH = (canvas.height * usableW) / canvas.width;

      let yOffset = 0;
      let page = 0;
      while (yOffset < imgH) {
        if (page > 0) pdf.addPage();
        const srcY = (yOffset / imgH) * canvas.height;
        const sliceH = Math.min((pageH - margin * 2) / imgH * canvas.height, canvas.height - srcY);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        const ctx = sliceCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const sliceData = sliceCanvas.toDataURL('image/png');
        const sliceRenderH = (sliceH / canvas.height) * imgH;
        pdf.addImage(sliceData, 'PNG', margin, margin, usableW, sliceRenderH);
        yOffset += pageH - margin * 2;
        page++;
      }

      const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`medical_report_${safeName}_${dateStr}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  const form2 = data?.form2 ?? {};
  const fd = data?.formData ?? {};

  const handleStatusSave = () => {
    onUpdateScreeningStatus?.(newStatus);
    setEditingStatus(false);
  };

  const reportDate = (data?.updatedAt || data?.updated_at)
    ? new Date(data.updatedAt || data.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Not available';

  // ── Surrogate: build data sections ──────────────────────────────────────────

  const gcInfectiousRows: LabRow[] = userType === 'surrogate' ? [
    { test: 'HIV (Human Immunodeficiency Virus)', result: form2?.infectiousDisease?.hiv ?? '', status: inferStatus(form2?.infectiousDisease?.hiv) },
    { test: 'HBsAg (Hepatitis B Surface Antigen)', result: form2?.infectiousDisease?.hbsag ?? '', status: inferStatus(form2?.infectiousDisease?.hbsag) },
    { test: 'HCV (Hepatitis C Virus)', result: form2?.infectiousDisease?.hcv ?? '', status: inferStatus(form2?.infectiousDisease?.hcv) },
    { test: 'VDRL (Syphilis)', result: form2?.infectiousDisease?.vdrl ?? '', status: inferStatus(form2?.infectiousDisease?.vdrl) },
    { test: 'TORCH Panel', result: form2?.infectiousDisease?.torch ?? '', status: inferStatus(form2?.infectiousDisease?.torch), note: 'Toxoplasma, Rubella, CMV, Herpes' },
  ] : [];

  const ipInfectiousRows: LabRow[] = userType === 'parent' ? [
    {
      test: 'HIV',
      result: fd?.ip_additional?.hiv_result === true ? 'Positive' : fd?.ip_additional?.hiv_result === false ? 'Negative' : fd?.ip_additional?.hiv ?? '',
      status: fd?.ip_additional?.hiv_result === true ? 'positive' : fd?.ip_additional?.hiv_result === false ? 'negative' : inferStatus(fd?.ip_additional?.hiv)
    },
    {
      test: 'HBsAg (Hepatitis B)',
      result: fd?.ip_additional?.hbs_ag_result === true ? 'Positive' : fd?.ip_additional?.hbs_ag_result === false ? 'Negative' : fd?.ip_additional?.hbsag ?? '',
      status: fd?.ip_additional?.hbs_ag_result === true ? 'positive' : fd?.ip_additional?.hbs_ag_result === false ? 'negative' : inferStatus(fd?.ip_additional?.hbsag)
    },
    {
      test: 'HCV (Hepatitis C)',
      result: fd?.ip_additional?.hcv_result === true ? 'Positive' : fd?.ip_additional?.hcv_result === false ? 'Negative' : fd?.ip_additional?.hcv ?? '',
      status: fd?.ip_additional?.hcv_result === true ? 'positive' : fd?.ip_additional?.hcv_result === false ? 'negative' : inferStatus(fd?.ip_additional?.hcv)
    },
    {
      test: 'VDRL (Syphilis)',
      result: fd?.ip_additional?.vdrl_result === true ? 'Positive' : fd?.ip_additional?.vdrl_result === false ? 'Negative' : fd?.ip_additional?.vdrl ?? '',
      status: fd?.ip_additional?.vdrl_result === true ? 'positive' : fd?.ip_additional?.vdrl_result === false ? 'negative' : inferStatus(fd?.ip_additional?.vdrl)
    },
    {
      test: 'CMV (Cytomegalovirus)',
      result: fd?.ip_additional?.cmv_result === true ? 'Positive' : fd?.ip_additional?.cmv_result === false ? 'Negative' : fd?.ip_additional?.cmv ?? '',
      status: fd?.ip_additional?.cmv_result === true ? 'positive' : fd?.ip_additional?.cmv_result === false ? 'negative' : inferStatus(fd?.ip_additional?.cmv)
    },
  ] : [];

  const overallClearanceStatus: ResultStatus = (() => {
    if (userType === 'surrogate') {
      const s = screeningStatus ?? '';
      if (s === 'Medically Cleared for Program') return 'cleared';
      if (s.includes('Hold') || s.includes('Declined')) return 'abnormal';
      if (s === 'In Progress' || s === 'Screening Scheduled') return 'pending';
      return 'pending';
    }
    return 'pending';
  })();

  const allRowsPending = (rows: LabRow[]) => rows.every(r => r.status === 'pending');

  return (
    <div className="space-y-5">

      {/* ── Download button ─────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <button
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-90 text-white text-sm font-semibold shadow-lg shadow-rose-500/20 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {downloading
            ? <><i className="ri-loader-4-line animate-spin text-base"></i> Generating PDF...</>
            : <><i className="ri-download-2-line text-base"></i> Download PDF</>
          }
        </button>
      </div>

      <div ref={reportRef} className="space-y-5 bg-white dark:bg-[#0e0b1a] rounded-2xl p-1">

        {/* ── Report Header ───────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-white to-rose-50/40 dark:from-[#15111f] dark:to-[#1a1530] rounded-2xl border border-rose-100/60 dark:border-white/5 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-rose-500/20">
                <i className="ri-heart-pulse-line text-white text-xl"></i>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 mb-0.5">Medical Report</p>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {userType === 'surrogate' ? 'Gestational Carrier' : 'Intended Parent'} · Last updated {reportDate}
                </p>
                {userId && (
                  <p className="text-[10px] font-mono text-gray-400 mt-1">ID: {userId}</p>
                )}
              </div>
            </div>

            {/* Clearance status pill */}
            {userType === 'surrogate' && (
              <div className="flex flex-col items-end gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Screening Status</p>
                {editingStatus ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="text-xs rounded-lg border border-rose-200 dark:border-white/10 bg-white dark:bg-black px-2 py-1 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                    >
                      {GC_MEDICAL_SCREENING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={handleStatusSave} className="px-2 py-1 text-xs font-semibold bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors">Save</button>
                    <button onClick={() => setEditingStatus(false)} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => { setNewStatus(screeningStatus ?? 'Not Started'); setEditingStatus(true); }} className="group flex items-center gap-2">
                    <ResultBadge status={overallClearanceStatus} label={screeningStatus ?? 'Not Started'} />
                    <i className="ri-pencil-line text-xs text-gray-300 group-hover:text-rose-400 transition-colors"></i>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick stats row */}
          {userType === 'surrogate' && (
            <div className="mt-5 pt-4 border-t border-rose-100/60 dark:border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'BMI', value: form2?.bmi ?? form2?.medicalFitness?.bmi ?? '—', icon: 'ri-scales-line' },
                { label: 'Blood Pressure', value: form2?.medicalFitness?.bp ?? '—', icon: 'ri-heart-pulse-line' },
                { label: 'Pregnancies', value: form2?.pregnancyHistory?.total ?? '—', icon: 'ri-women-line' },
                { label: 'C-Sections', value: form2?.pregnancyHistory?.cSection ?? '—', icon: 'ri-surgical-mask-line' },
              ].map(s => (
                <div key={s.label} className="bg-rose-50/60 dark:bg-white/5 rounded-xl px-3 py-2.5 text-center">
                  <i className={`${s.icon} text-rose-400 text-base block mb-1`}></i>
                  <p className="text-base font-bold text-gray-900 dark:text-white">{s.value}</p>
                  <p className="text-[10px] text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {userType === 'parent' && (
            <div className="mt-5 pt-4 border-t border-rose-100/60 dark:border-white/5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Fertility Clinic', value: fd?.fertility?.fertility_doctor ?? data?.fertility?.clinicName ?? data?.form2Data?.fertilityClinic ?? '—', icon: 'ri-hospital-line' },
                { label: 'Embryos Available', value: fd?.fertility?.number_of_embryos ?? data?.form2Data?.embryosAvailable ?? '—', icon: 'ri-test-tube-line' },
                { label: 'Embryo Quality', value: fd?.fertility?.pgd_pgs_testing_info ?? data?.form2Data?.embryoQuality ?? '—', icon: 'ri-seedling-line' },
              ].map(s => (
                <div key={s.label} className="bg-rose-50/60 dark:bg-white/5 rounded-xl px-3 py-2.5 text-center">
                  <i className={`${s.icon} text-rose-400 text-base block mb-1`}></i>
                  <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{s.value}</p>
                  <p className="text-[10px] text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── SURROGATE SECTIONS ──────────────────────────────────────────────── */}
        {userType === 'surrogate' && (
          <>
            {/* Medical Fitness */}
            <SectionCard title="Medical Fitness" icon="ri-stethoscope-line" accentColor="from-emerald-50 to-teal-50/50 dark:from-emerald-500/10 dark:to-transparent text-emerald-700 dark:text-emerald-300">
              <FieldRow label="Gynaecological Exam" value={form2?.medicalFitness?.gynecologicalExam} />
              <FieldRow label="Obstetric History" value={form2?.medicalFitness?.obstetricHistory} />
              <FieldRow label="General Health Clearance" value={form2?.medicalFitness?.generalHealthClearance} />
              <FieldRow label="BMI" value={form2?.medicalFitness?.bmi ?? form2?.bmi} />
              <FieldRow label="Blood Pressure" value={form2?.medicalFitness?.bp} />
              <FieldRow label="Current Medications" value={form2?.medications} />
              <FieldRow label="Smoker" value={form2?.smoker === true ? 'Yes' : form2?.smoker === false ? 'No' : undefined} />
              <FieldRow label="Support System" value={form2?.supportSystem} />
            </SectionCard>

            {/* Pregnancy History */}
            <SectionCard title="Obstetric / Pregnancy History" icon="ri-women-line" accentColor="from-pink-50 to-rose-50/50 dark:from-pink-500/10 dark:to-transparent text-pink-700 dark:text-pink-300">
              <FieldRow label="Total Pregnancies" value={form2?.pregnancyHistory?.total} />
              <FieldRow label="Vaginal Deliveries" value={form2?.pregnancyHistory?.vaginal} />
              <FieldRow label="C-Sections" value={form2?.pregnancyHistory?.cSection} />
              <FieldRow label="Prior Surrogacy Children" value={form2?.surrogacyChildren} />
              <FieldRow label="Availability" value={form2?.availability} />
            </SectionCard>

            {/* Infectious Disease */}
            <SectionCard
              title="Infectious Disease Panel"
              icon="ri-virus-line"
              accentColor="from-violet-50 to-purple-50/50 dark:from-violet-500/10 dark:to-transparent text-violet-700 dark:text-violet-300"
              badge={
                allRowsPending(gcInfectiousRows)
                  ? <ResultBadge status="pending" label="Awaiting Results" />
                  : gcInfectiousRows.some(r => r.status === 'positive')
                    ? <ResultBadge status="positive" label="Review Required" />
                    : <ResultBadge status="negative" label="All Negative" />
              }
            >
              {gcInfectiousRows.map(row => <LabTestRow key={row.test} row={row} />)}
              <DocumentLinks urls={
                (data?.documents || []).filter((d: any) => d.category === 'Medical' && (d.name?.toLowerCase().includes('disease') || d.name?.toLowerCase().includes('infectious') || d.name?.toLowerCase().includes('screening') || true)).map((d: any) => d.url)
              } label="Uploaded Medical Documents" onPreview={setPreviewUrl} />
            </SectionCard>

            {/* Psychological Clearance */}
            <SectionCard title="Psychological Clearance" icon="ri-brain-line" accentColor="from-blue-50 to-indigo-50/50 dark:from-blue-500/10 dark:to-transparent text-blue-700 dark:text-blue-300">
              <FieldRow label="Clearance Document" value={form2?.psychClearance?.mentalHealthClearanceDoc} />
              <DocumentLinks urls={[
                ...(data?.documents || []).filter((d: any) => d.category === 'Medical' && (d.name?.toLowerCase().includes('psych') || d.name?.toLowerCase().includes('clearance'))).map((d: any) => d.url),
                form2?.psychClearance?.mentalHealthClearanceDoc
              ]} label="Uploaded Clearance Documents" onPreview={setPreviewUrl} />
            </SectionCard>
          </>
        )}

        {/* ── PARENT SECTIONS ──────────────────────────────────────────────────── */}
        {userType === 'parent' && (
          <>
            {/* Fertility Clinic */}
            <SectionCard title="Fertility Clinic & Physician" icon="ri-hospital-line" accentColor="from-emerald-50 to-teal-50/50 dark:from-emerald-500/10 dark:to-transparent text-emerald-700 dark:text-emerald-300">
              <FieldRow label="Clinic Name" value={fd?.fertility?.fertility_doctor ?? data?.fertility?.clinicName ?? data?.form2Data?.fertilityClinic} />
              <FieldRow label="Physician" value={fd?.fertility?.fertility_doctor ?? data?.fertility?.physician} />
              <FieldRow label="Clinic Contact" value={fd?.ip_additional?.clinic_contact ?? data?.fertility?.clinicContact} />
              <FieldRow label="Legal Counsel" value={fd?.ip_additional?.legal_counsel ?? data?.form2Data?.legalCounsel} />
              <FieldRow label="Timeline" value={fd?.fertility?.fertility_history_info ?? data?.form2Data?.timeline} />
            </SectionCard>

            {/* Fertility Assessment */}
            <SectionCard title="Fertility Assessment" icon="ri-test-tube-line" accentColor="from-pink-50 to-rose-50/50 dark:from-pink-500/10 dark:to-transparent text-pink-700 dark:text-pink-300">
              <FieldRow label="IVF Evaluation Summary" value={fd?.ip_additional?.ivf_evaluation_summary ?? data?.form2Data?.fertility?.ivfEvaluationSummary} />
              <FieldRow label="Ovarian Reserve (AMH)" value={fd?.ip_additional?.ovarian_reserve_amh ?? data?.form2Data?.fertility?.ovarianReserveAMH} />
              <FieldRow label="Semen Analysis" value={fd?.ip_additional?.semen_analysis ?? data?.form2Data?.fertility?.semenAnalysis} />
              <FieldRow label="Diagnosis" value={fd?.ip_additional?.diagnosis ?? data?.form2Data?.fertility?.diagnosis} />
              <FieldRow label="Embryo Report" value={fd?.fertility?.pgd_pgs_testing_info ?? data?.fertility?.embryoReport} />
              <FieldRow label="Genetic Testing" value={fd?.fertility?.pgd_pgs_tested ? 'Yes' : fd?.fertility?.pgd_pgs_tested === false ? 'No' : undefined} />
            </SectionCard>

            {/* Embryo Records */}
            <SectionCard title="Embryo Records" icon="ri-seedling-line" accentColor="from-amber-50 to-yellow-50/50 dark:from-amber-500/10 dark:to-transparent text-amber-700 dark:text-amber-300">
              <FieldRow label="Embryos Available" value={fd?.fertility?.number_of_embryos ?? data?.form2Data?.embryosAvailable} />
              <FieldRow label="Embryo Quality" value={fd?.fertility?.pgd_pgs_testing_info ?? data?.form2Data?.embryoQuality} />
              <FieldRow label="Embryo Freezing Report" value={fd?.fertility?.using_frozen_embryos ? `Frozen on ${fd.fertility.embryos_frozen_date}` : 'Not Available'} />
              <FieldRow label="Donor Screening Report" value={fd?.fertility?.egg_provider} />
              <DocumentLinks urls={fd?.ip_additional?.embryo_records_urls || data?.ipAdditional?.embryo_records_urls} label="Uploaded Embryo Records" onPreview={setPreviewUrl} />
            </SectionCard>

            {/* Infectious Disease */}
            <SectionCard
              title="Infectious Disease Panel"
              icon="ri-virus-line"
              accentColor="from-violet-50 to-purple-50/50 dark:from-violet-500/10 dark:to-transparent text-violet-700 dark:text-violet-300"
              badge={
                allRowsPending(ipInfectiousRows)
                  ? <ResultBadge status="pending" label="Awaiting Results" />
                  : ipInfectiousRows.some(r => r.status === 'positive')
                    ? <ResultBadge status="positive" label="Review Required" />
                    : <ResultBadge status="negative" label="All Negative" />
              }
            >
              {ipInfectiousRows.map(row => <LabTestRow key={row.test} row={row} />)}
              <DocumentLinks urls={fd?.ip_additional?.disease_screening_urls || data?.ipAdditional?.disease_screening_urls} label="Uploaded Screening Reports" onPreview={setPreviewUrl} />
            </SectionCard>

            {/* Medical History */}
            <SectionCard title="Medical History" icon="ri-file-text-line" accentColor="from-blue-50 to-indigo-50/50 dark:from-blue-500/10 dark:to-transparent text-blue-700 dark:text-blue-300">
              <FieldRow label="General Medical History" value={fd?.ip_additional?.medical_history ?? data?.form2Data?.medicalHistory} />
              <FieldRow label="Budget" value={fd?.ip_additional?.budget ?? data?.form2Data?.surrogacyBudget} />
              <DocumentLinks urls={fd?.ip_additional?.fertility_report_urls || data?.ipAdditional?.fertility_report_urls} label="Uploaded Fertility Reports" onPreview={setPreviewUrl} />
            </SectionCard>
          </>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────────── */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400 dark:text-white/20">
            Data sourced from app-submitted forms · Last updated {reportDate}
          </p>
        </div>

      </div>{/* end reportRef */}

      {/* ── Document Preview Modal ─────────────────────────────────────────── */}
      {previewUrl && (
        <DocumentPreviewModal
          url={previewUrl}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </div>
  );
}
