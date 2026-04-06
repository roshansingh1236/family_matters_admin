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
    negative:  { cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20', icon: 'ri-checkbox-circle-fill', text: 'Negative' },
    normal:    { cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20', icon: 'ri-checkbox-circle-fill', text: 'Normal' },
    cleared:   { cls: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400 border-teal-200 dark:border-teal-500/20', icon: 'ri-shield-check-fill', text: 'Cleared' },
    positive:  { cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-200 dark:border-red-500/20', icon: 'ri-close-circle-fill', text: 'Positive' },
    abnormal:  { cls: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border-orange-200 dark:border-orange-500/20', icon: 'ri-alert-fill', text: 'Abnormal' },
    pending:   { cls: 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400 border-gray-200 dark:border-white/10', icon: 'ri-time-line', text: 'Pending' },
    not_done:  { cls: 'bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500 border-gray-200 dark:border-white/10', icon: 'ri-minus-circle-line', text: 'Not Done' },
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

const SectionCard: React.FC<{
  title: string;
  icon: string;
  accentColor: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}> = ({ title, icon, accentColor, children, badge }) => (
  <div className="bg-white dark:bg-[#15111f] rounded-2xl border border-rose-100/60 dark:border-white/5 overflow-hidden shadow-sm">
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
  const fd    = data?.formData ?? {};

  const handleStatusSave = () => {
    onUpdateScreeningStatus?.(newStatus);
    setEditingStatus(false);
  };

  const reportDate = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
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
    { test: 'HIV', result: data?.infectiousDisease?.hiv ?? fd?.infectiousDisease?.hiv ?? '', status: inferStatus(data?.infectiousDisease?.hiv ?? fd?.infectiousDisease?.hiv) },
    { test: 'HBsAg', result: data?.infectiousDisease?.hbsag ?? fd?.infectiousDisease?.hbsag ?? '', status: inferStatus(data?.infectiousDisease?.hbsag ?? fd?.infectiousDisease?.hbsag) },
    { test: 'HCV', result: data?.infectiousDisease?.hcv ?? fd?.infectiousDisease?.hcv ?? '', status: inferStatus(data?.infectiousDisease?.hcv ?? fd?.infectiousDisease?.hcv) },
    { test: 'VDRL (Syphilis)', result: data?.infectiousDisease?.vdrl ?? fd?.infectiousDisease?.vdrl ?? '', status: inferStatus(data?.infectiousDisease?.vdrl ?? fd?.infectiousDisease?.vdrl) },
    { test: 'CMV (Cytomegalovirus)', result: data?.infectiousDisease?.cmv ?? fd?.infectiousDisease?.cmv ?? '', status: inferStatus(data?.infectiousDisease?.cmv ?? fd?.infectiousDisease?.cmv) },
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
              { label: 'Fertility Clinic', value: data?.fertility?.clinicName ?? data?.form2Data?.fertilityClinic ?? '—', icon: 'ri-hospital-line' },
              { label: 'Embryos Available', value: data?.form2Data?.embryosAvailable ?? '—', icon: 'ri-test-tube-line' },
              { label: 'Embryo Quality', value: data?.form2Data?.embryoQuality ?? '—', icon: 'ri-seedling-line' },
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
          </SectionCard>

          {/* Psychological Clearance */}
          <SectionCard title="Psychological Clearance" icon="ri-brain-line" accentColor="from-blue-50 to-indigo-50/50 dark:from-blue-500/10 dark:to-transparent text-blue-700 dark:text-blue-300">
            <FieldRow label="Clearance Document" value={form2?.psychClearance?.mentalHealthClearanceDoc} />
          </SectionCard>
        </>
      )}

      {/* ── PARENT SECTIONS ──────────────────────────────────────────────────── */}
      {userType === 'parent' && (
        <>
          {/* Fertility Clinic */}
          <SectionCard title="Fertility Clinic & Physician" icon="ri-hospital-line" accentColor="from-emerald-50 to-teal-50/50 dark:from-emerald-500/10 dark:to-transparent text-emerald-700 dark:text-emerald-300">
            <FieldRow label="Clinic Name" value={data?.fertility?.clinicName ?? data?.form2Data?.fertilityClinic} />
            <FieldRow label="Physician" value={data?.fertility?.physician} />
            <FieldRow label="Clinic Contact" value={data?.fertility?.clinicContact} />
            <FieldRow label="Legal Counsel" value={data?.form2Data?.legalCounsel} />
            <FieldRow label="Timeline" value={data?.form2Data?.timeline} />
          </SectionCard>

          {/* Fertility Assessment */}
          <SectionCard title="Fertility Assessment" icon="ri-test-tube-line" accentColor="from-pink-50 to-rose-50/50 dark:from-pink-500/10 dark:to-transparent text-pink-700 dark:text-pink-300">
            <FieldRow label="IVF Evaluation Summary" value={data?.fertility?.ivfEvaluationSummary ?? data?.medicalReports?.ivfEvaluationSummary} />
            <FieldRow label="Ovarian Reserve (AMH)" value={data?.fertility?.ovarianReserveAMH ?? data?.medicalReports?.ovarianReserveAMH} />
            <FieldRow label="Semen Analysis" value={data?.fertility?.semenAnalysis ?? data?.medicalReports?.semenAnalysis} />
            <FieldRow label="Diagnosis" value={data?.fertility?.diagnosis ?? data?.medicalReports?.diagnosis} />
            <FieldRow label="Embryo Report" value={data?.fertility?.embryoReport} />
            <FieldRow label="Genetic Testing" value={data?.fertility?.geneticTesting} />
          </SectionCard>

          {/* Embryo Records */}
          <SectionCard title="Embryo Records" icon="ri-seedling-line" accentColor="from-amber-50 to-yellow-50/50 dark:from-amber-500/10 dark:to-transparent text-amber-700 dark:text-amber-300">
            <FieldRow label="Embryos Available" value={data?.form2Data?.embryosAvailable} />
            <FieldRow label="Embryo Quality" value={data?.form2Data?.embryoQuality} />
            <FieldRow label="Embryo Freezing Report" value={data?.embryoRecords?.embryoFreezingReport ?? data?.medicalReports?.embryoFreezingReport} />
            <FieldRow label="Donor Screening Report" value={data?.embryoRecords?.donorScreeningReport ?? data?.medicalReports?.donorScreeningReport} />
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
          </SectionCard>

          {/* Medical History */}
          <SectionCard title="Medical History" icon="ri-file-text-line" accentColor="from-blue-50 to-indigo-50/50 dark:from-blue-500/10 dark:to-transparent text-blue-700 dark:text-blue-300">
            <FieldRow label="General Medical History" value={data?.form2Data?.medicalHistory} />
            <FieldRow label="Budget" value={data?.form2Data?.surrogacyBudget} />
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
    </div>
  );
}
