/**
 * Flutter medical_screening_form.dart saves flat keys on form_data.surrogate_profile.
 * Admin UI expects nested medicalFitness / infectiousDisease / psychClearance.
 * This module derives the nested shape for display and editing.
 */

type JsonObj = Record<string, unknown>;

/** Merge surrogate_profile, optional medical_screening blob, and resolved form2 (last wins). */
export function medicalIntakeProfileSource(
  surrogate: Record<string, unknown> | null | undefined
): JsonObj | null {
  if (!surrogate) return null;
  const fd = (surrogate.formData ?? surrogate.form_data ?? {}) as JsonObj;
  const fromMedical = fd.medical_screening as JsonObj | undefined;
  const fromAdditional = (fd.gc_additional ?? surrogate.form2_data ?? surrogate.form2Data) as JsonObj | undefined;
  const fromSp = fd.surrogate_profile as JsonObj | undefined;
  const fromForm2 = surrogate.form2 as JsonObj | undefined;

  const merged: JsonObj = {};
  if (fromMedical && typeof fromMedical === 'object') Object.assign(merged, fromMedical);
  if (fromAdditional && typeof fromAdditional === 'object') Object.assign(merged, fromAdditional);
  if (fromSp && typeof fromSp === 'object') Object.assign(merged, fromSp);
  if (fromForm2 && typeof fromForm2 === 'object') Object.assign(merged, fromForm2);

  if (Object.keys(merged).length === 0) return null;
  return merged;
}

const FLAT_APP_SCREENING_KEYS = [
  'gynecologicalExamDone',
  'obstetricHistorySummary',
  'bmiAndBp',
  'generalHealthClearance',
  'hivTest',
  'hbsAgTest',
  'hcvTest',
  'vdrlTest',
  'torchTest',
  'psychEvalDone',
  'psychEvalSummary'
] as const;

/** Raw app fields (for transparency when nested panels already show mapped values). */
export function flatScreeningEntries(profile: JsonObj | null | undefined): [string, string][] {
  if (!profile) return [];
  return FLAT_APP_SCREENING_KEYS.filter((k) => {
    const v = profile[k];
    if (v === null || v === undefined) return false;
    return String(v).trim().length > 0;
  }).map((k) => [k, String(profile[k])]);
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function yesNo(v: unknown): string {
  const s = str(v).trim();
  if (s === 'true' || s === 'True') return 'Yes';
  if (s === 'false' || s === 'False') return 'No';
  return s;
}

export function medicalFitnessFromProfile(sp: JsonObj | null | undefined): JsonObj | null {
  if (!sp || typeof sp !== 'object') return null;
  const nested = sp.medicalFitness as JsonObj | undefined;
  if (nested && typeof nested === 'object' && Object.keys(nested).length > 0) {
    return nested;
  }

  const hasFlat =
    sp.gynecologicalExamDone != null ||
    sp.obstetricHistorySummary != null ||
    sp.bmiAndBp != null ||
    sp.generalHealthClearance != null;
  if (!hasFlat) return null;

  const rawBmiBp = str(sp.bmiAndBp);
  let bmi = '';
  let bp = '';
  if (rawBmiBp.includes('/') || rawBmiBp.includes(',')) {
    const parts = rawBmiBp.split(/[/,]/).map((p) => p.trim());
    bmi = parts[0] ?? '';
    bp = parts.slice(1).join(' / ');
  } else {
    bmi = rawBmiBp;
  }

  return {
    gynecologicalExam: yesNo(sp.gynecologicalExamDone),
    obstetricHistory: str(sp.obstetricHistorySummary),
    bmi,
    bp,
    generalHealthClearance: yesNo(sp.generalHealthClearance)
  };
}

export function infectiousDiseaseFromProfile(sp: JsonObj | null | undefined): JsonObj | null {
  if (!sp || typeof sp !== 'object') return null;
  const nested = sp.infectiousDisease as JsonObj | undefined;
  if (nested && typeof nested === 'object' && Object.keys(nested).length > 0) {
    return nested;
  }

  const hasFlat =
    sp.hivTest != null ||
    sp.hbsAgTest != null ||
    sp.hcvTest != null ||
    sp.vdrlTest != null ||
    sp.torchTest != null;
  if (!hasFlat) return null;

  return {
    hiv: yesNo(sp.hivTest),
    hbsag: yesNo(sp.hbsAgTest),
    hcv: yesNo(sp.hcvTest),
    vdrl: yesNo(sp.vdrlTest),
    torch: yesNo(sp.torchTest)
  };
}

export function psychClearanceFromProfile(sp: JsonObj | null | undefined): JsonObj | null {
  if (!sp || typeof sp !== 'object') return null;
  const nested = sp.psychClearance as JsonObj | undefined;
  if (nested && typeof nested === 'object' && Object.keys(nested).length > 0) {
    return nested;
  }

  const hasFlat = sp.psychEvalDone != null || str(sp.psychEvalSummary).length > 0;
  if (!hasFlat) return null;

  const lines: string[] = [];
  if (sp.psychEvalDone !== undefined && sp.psychEvalDone !== null && sp.psychEvalDone !== '') {
    lines.push(`Evaluation completed: ${yesNo(sp.psychEvalDone)}`);
  }
  const sum = str(sp.psychEvalSummary);
  if (sum) lines.push(sum);
  if (lines.length === 0) return null;

  return {
    mentalHealthClearanceDoc: lines.join('\n\n').trim()
  };
}
