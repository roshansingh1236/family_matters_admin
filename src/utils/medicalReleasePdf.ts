import jsPDF from 'jspdf';
import {
  MEDICAL_RELEASE_ACKNOWLEDGEMENT,
  MEDICAL_RELEASE_ADDRESS_LABEL,
  MEDICAL_RELEASE_AUTHORIZATION,
  MEDICAL_RELEASE_CITY_STATE_ZIP_CAPTION,
  MEDICAL_RELEASE_DATE_LABEL,
  MEDICAL_RELEASE_DOB_LABEL,
  MEDICAL_RELEASE_FOOTER_TITLE,
  MEDICAL_RELEASE_FOOTER_WEBSITE,
  MEDICAL_RELEASE_INFORMATION_COLUMNS,
  MEDICAL_RELEASE_INFORMATION_HEADING,
  MEDICAL_RELEASE_PATIENT_NAME_LABEL,
  MEDICAL_RELEASE_PRINTED_NAME_LABEL,
  MEDICAL_RELEASE_PROVIDER_CONTACT_CAPTION,
  MEDICAL_RELEASE_PROVIDER_NAME_CAPTION,
  MEDICAL_RELEASE_SIGNATURE_LABEL,
  MEDICAL_RELEASE_SSN_LABEL,
  MEDICAL_RELEASE_STREET_CAPTION,
  MEDICAL_RELEASE_TERMS,
  MEDICAL_RELEASE_TITLE,
  MEDICAL_RELEASE_TO_ADDRESS_LINES,
  MEDICAL_RELEASE_TO_EMAIL,
  MEDICAL_RELEASE_TO_FAX,
  MEDICAL_RELEASE_TO_HEADING,
  MEDICAL_RELEASE_TO_NAME,
  formatCityStateZip,
  formatProviderContact,
} from '../constants/medicalRelease';
import {
  MEDICAL_RELEASE_LOGO,
  MEDICAL_RELEASE_LOGO_HEIGHT,
  MEDICAL_RELEASE_LOGO_WIDTH,
} from '../constants/medicalReleaseLogo';
import { formatReleaseDate, type MedicalRelease } from '../services/medicalReleaseService';

/** File name for a surrogate's signed release, e.g. "Medical Release - Jane Doe.pdf". */
export function medicalReleaseFileName(release: Pick<MedicalRelease, 'patientName'>): string {
  const safe = (release.patientName || 'Surrogate').replace(/[^\w .'-]/g, '').trim() || 'Surrogate';
  return `Medical Release - ${safe}.pdf`;
}

// The built-in PDF fonts have no typographic apostrophe.
const plain = (s: string) => s.replace(/’/g, "'");

/**
 * Builds the signed release as a one-page US Letter PDF that reproduces the
 * agency's paper form — same logo, tables, wording and footer — with the
 * surrogate's answers filled in.
 */
export function buildMedicalReleasePdf(release: MedicalRelease): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 72; // the paper form has 1" side margins
  const width = pageWidth - left * 2;
  const centre = pageWidth / 2;
  const SIZE = 11; // 11pt Arial on the paper form
  const pad = 5;
  let y = 12;

  const font = (style: 'normal' | 'bold' | 'italic' | 'bolditalic', size = SIZE) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
  };

  const underline = (x: number, baseline: number, w: number) => {
    doc.setLineWidth(0.7);
    doc.line(x, baseline + 1.5, x + w, baseline + 1.5);
  };

  const centred = (text: string, style: 'normal' | 'bold', opts: { underlined?: boolean } = {}) => {
    font(style);
    doc.text(text, centre, y, { align: 'center' });
    if (opts.underlined) {
      const w = doc.getTextWidth(text);
      underline(centre - w / 2, y, w);
    }
    y += 12.6;
  };

  /** Bold label followed by the filled-in value. */
  const labelled = (label: string, value: string, x: number, baseline: number) => {
    font('bold');
    doc.text(plain(label), x, baseline);
    const w = doc.getTextWidth(plain(label));
    font('normal');
    if (value) doc.text(value, x + w + 6, baseline);
  };

  // ── Bordered tables ──
  type Row =
    | { kind: 'labelled'; label: string; value: string }
    | { kind: 'split'; left: [string, string]; right: [string, string] }
    | { kind: 'value'; value: string }
    | { kind: 'caption'; text: string };

  const rowHeight = (row: Row) => (row.kind === 'caption' ? 14 : 17);

  const table = (rows: Row[]) => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    const top = y;
    rows.forEach((row) => {
      const h = rowHeight(row);
      const baseline = y + h - (row.kind === 'caption' ? 3.5 : 5);
      if (row.kind === 'labelled') {
        labelled(row.label, row.value, left + pad, baseline);
      } else if (row.kind === 'split') {
        const splitAt = left + width * (4315 / 9350);
        labelled(row.left[0], row.left[1], left + pad, baseline);
        labelled(row.right[0], row.right[1], splitAt + pad, baseline);
        doc.line(splitAt, y, splitAt, y + h);
      } else if (row.kind === 'value') {
        font('normal');
        if (row.value) doc.text(row.value, left + pad, baseline);
      } else {
        font('bolditalic');
        doc.text(row.text, centre, baseline, { align: 'center' });
      }
      y += h;
      doc.line(left, y, left + width, y);
    });
    doc.rect(left, top, width, y - top);
  };

  // ── Logo + title ──
  const logoW = 150;
  const logoH = (logoW * MEDICAL_RELEASE_LOGO_HEIGHT) / MEDICAL_RELEASE_LOGO_WIDTH;
  try {
    doc.addImage(MEDICAL_RELEASE_LOGO, 'JPEG', centre - logoW / 2, y, logoW, logoH);
  } catch (e) {
    console.error('Could not embed the form logo', e);
  }
  y += logoH + 14;
  centred(MEDICAL_RELEASE_TITLE, 'bold', { underlined: true });
  y -= 6;

  // ── Patient ──
  table([
    { kind: 'labelled', label: MEDICAL_RELEASE_PATIENT_NAME_LABEL, value: release.patientName },
    {
      kind: 'split',
      left: [MEDICAL_RELEASE_DOB_LABEL, formatReleaseDate(release.dateOfBirth)],
      right: [MEDICAL_RELEASE_SSN_LABEL, release.ssn],
    },
    { kind: 'labelled', label: MEDICAL_RELEASE_ADDRESS_LABEL, value: release.streetAddress },
    { kind: 'caption', text: MEDICAL_RELEASE_STREET_CAPTION },
    { kind: 'value', value: formatCityStateZip(release.city, release.state, release.zip) },
    { kind: 'caption', text: MEDICAL_RELEASE_CITY_STATE_ZIP_CAPTION },
  ]);

  // ── Authorisation ──
  font('bold');
  y += 13;
  const authLines = doc.splitTextToSize(MEDICAL_RELEASE_AUTHORIZATION, width - pad * 2) as string[];
  doc.text(authLines, left + pad, y);
  y += (authLines.length - 1) * 12.6 + 9;

  // ── Provider ──
  table([
    { kind: 'value', value: release.providerName },
    { kind: 'caption', text: MEDICAL_RELEASE_PROVIDER_NAME_CAPTION },
    { kind: 'value', value: formatProviderContact(release.providerPhone, release.providerFax) },
    { kind: 'caption', text: MEDICAL_RELEASE_PROVIDER_CONTACT_CAPTION },
  ]);
  y += 22;

  // ── Release to ──
  centred(MEDICAL_RELEASE_TO_HEADING, 'bold', { underlined: true });
  centred(MEDICAL_RELEASE_TO_NAME, 'normal');
  MEDICAL_RELEASE_TO_ADDRESS_LINES.forEach((line) => centred(line, 'normal'));

  font('bold');
  const emailLabel = 'EMAIL: ';
  const emailLabelW = doc.getTextWidth(emailLabel);
  const emailW = doc.getTextWidth(MEDICAL_RELEASE_TO_EMAIL);
  const emailX = centre - (emailLabelW + emailW) / 2;
  doc.text(emailLabel, emailX, y);
  doc.setTextColor(5, 99, 193);
  doc.setDrawColor(5, 99, 193);
  doc.text(MEDICAL_RELEASE_TO_EMAIL, emailX + emailLabelW, y);
  underline(emailX + emailLabelW, y, emailW);
  doc.setTextColor(0);
  doc.setDrawColor(0);
  y += 12.6;
  centred(`FAX: ${MEDICAL_RELEASE_TO_FAX}`, 'bold');
  y += 6;

  // ── Information to be released ──
  centred(MEDICAL_RELEASE_INFORMATION_HEADING, 'bold', { underlined: true });
  y += 6;
  font('normal');
  const infoLeft = left + 28;
  const infoWidth = width - 28;
  const flexes = [3235, 2610, 2610];
  const flexTotal = flexes.reduce((a, b) => a + b, 0);
  let colX = infoLeft;
  let infoRows = 0;
  MEDICAL_RELEASE_INFORMATION_COLUMNS.forEach((items, col) => {
    items.forEach((item, i) => doc.text(`*${item}`, colX, y + i * 16.6));
    infoRows = Math.max(infoRows, items.length);
    colX += (infoWidth * flexes[col]) / flexTotal;
  });
  y += infoRows * 16.6 + 2;

  // ── Numbered statements (6pt small print) ──
  MEDICAL_RELEASE_TERMS.forEach((term, i) => {
    font('normal', 7);
    doc.text(`${i + 1}.`, left + 24, y);
    font('normal', 6);
    const lines = doc.splitTextToSize(term, width - 42) as string[];
    doc.text(lines, left + 42, y);
    y += lines.length * 6.9 + 7;
  });
  font('normal', 6);
  y += 2;
  doc.text(MEDICAL_RELEASE_ACKNOWLEDGEMENT, left + pad, y);
  y += 24;

  // ── Signature lines ──
  doc.setLineWidth(0.5);
  labelled(MEDICAL_RELEASE_PRINTED_NAME_LABEL, release.printedName, left + pad, y);
  y += 5;
  doc.line(left, y, left + width, y);

  const sigRowHeight = 36;
  const sigBaseline = y + sigRowHeight - 14;
  const dateX = left + width * (7020 / 9350);
  font('bold');
  doc.text(plain(MEDICAL_RELEASE_SIGNATURE_LABEL), left + pad, sigBaseline);
  const sigLabelW = doc.getTextWidth(plain(MEDICAL_RELEASE_SIGNATURE_LABEL));
  if (release.signaturePng) {
    try {
      const src = `data:image/png;base64,${release.signaturePng}`;
      const props = doc.getImageProperties(src);
      const maxH = 32;
      const maxW = dateX - (left + pad + sigLabelW + 8) - 8;
      const scale = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * scale;
      const h = props.height * scale;
      doc.addImage(src, 'PNG', left + pad + sigLabelW + 8, y + (sigRowHeight - h) / 2, w, h);
    } catch (e) {
      console.error('Could not embed signature image', e);
    }
  }
  labelled(MEDICAL_RELEASE_DATE_LABEL, formatReleaseDate(release.signedAt), dateX, sigBaseline);
  y += sigRowHeight;
  doc.line(left, y, left + width, y);

  // ── Footer (lilac, as on the paper form) ──
  const footerY = pageHeight - 86;
  font('bold');
  doc.setTextColor(204, 153, 255);
  doc.setDrawColor(204, 153, 255);
  doc.text(MEDICAL_RELEASE_FOOTER_TITLE, left, footerY);
  doc.text('Page 1 of 1', left + width - 36, footerY, { align: 'right' });
  doc.text(MEDICAL_RELEASE_FOOTER_WEBSITE, left, footerY + 12.6);
  underline(left, footerY + 12.6, doc.getTextWidth(MEDICAL_RELEASE_FOOTER_WEBSITE));
  doc.setTextColor(0);
  doc.setDrawColor(0);

  return doc;
}
