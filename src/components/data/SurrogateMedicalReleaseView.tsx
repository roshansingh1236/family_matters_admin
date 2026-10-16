import { useCallback, useEffect, useState } from 'react';
import Button from '../base/Button';
import Badge from '../base/Badge';
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
} from '../../constants/medicalRelease';
import { MEDICAL_RELEASE_LOGO } from '../../constants/medicalReleaseLogo';
import {
  formatReleaseDate,
  maskSsn,
  medicalReleaseService,
  type MedicalRelease,
} from '../../services/medicalReleaseService';
import { buildMedicalReleasePdf, medicalReleaseFileName } from '../../utils/medicalReleasePdf';

type SurrogateMedicalReleaseViewProps = {
  /** The surrogate's user id. */
  userId: string;
  onOpenDocumentsTab?: () => void;
};

// The sheet is always black-on-white, like the paper form, in light and dark mode.
const cell = 'border border-black px-2 py-1 align-middle';
const caption = 'border border-black px-2 py-0.5 text-center font-bold italic';
const heading = 'text-center font-bold underline';

/**
 * The signed form, laid out exactly like the agency's paper "Surrogate Release
 * of Medical Records" form with the surrogate's answers filled in.
 */
export function ReleaseSheet({
  release,
  showSsn,
  onToggleSsn,
}: {
  release: MedicalRelease;
  showSsn: boolean;
  onToggleSsn: () => void;
}) {
  return (
    <div
      data-testid="medical-release-sheet"
      className="mx-auto w-full max-w-[816px] bg-white text-black shadow-lg ring-1 ring-black/10"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14.67px', lineHeight: 1.2 }}
    >
      <div className="px-6 pb-10 pt-4 sm:px-24">
        <img
          src={MEDICAL_RELEASE_LOGO}
          alt="Family Matters Surrogacy"
          className="mx-auto block h-auto w-[200px]"
        />
        <h3 className={`${heading} mt-4`}>{MEDICAL_RELEASE_TITLE}</h3>

        {/* Patient */}
        <table className="mt-1 w-full border-collapse">
          <tbody>
            <tr>
              <td colSpan={2} className={cell}>
                <span className="font-bold">{MEDICAL_RELEASE_PATIENT_NAME_LABEL}</span>{' '}
                <span className="ml-1">{release.patientName}</span>
              </td>
            </tr>
            <tr>
              <td className={cell} style={{ width: '46.15%' }}>
                <span className="font-bold">{MEDICAL_RELEASE_DOB_LABEL}</span>{' '}
                <span className="ml-1">{formatReleaseDate(release.dateOfBirth)}</span>
              </td>
              <td className={cell}>
                <span className="font-bold">{MEDICAL_RELEASE_SSN_LABEL}</span>{' '}
                <span className="ml-1">{showSsn ? release.ssn : maskSsn(release.ssn)}</span>
                <button
                  type="button"
                  onClick={onToggleSsn}
                  aria-label={showSsn ? 'Hide Social Security Number' : 'Show Social Security Number'}
                  className="ml-2 cursor-pointer text-gray-500 hover:text-rose-600 print:hidden"
                >
                  <i className={showSsn ? 'ri-eye-off-line' : 'ri-eye-line'} />
                </button>
              </td>
            </tr>
            <tr>
              <td colSpan={2} className={cell}>
                <span className="font-bold">{MEDICAL_RELEASE_ADDRESS_LABEL}</span>{' '}
                <span className="ml-1">{release.streetAddress}</span>
              </td>
            </tr>
            <tr>
              <td colSpan={2} className={caption}>{MEDICAL_RELEASE_STREET_CAPTION}</td>
            </tr>
            <tr>
              <td colSpan={2} className={cell}>
                {formatCityStateZip(release.city, release.state, release.zip) || ' '}
              </td>
            </tr>
            <tr>
              <td colSpan={2} className={caption}>{MEDICAL_RELEASE_CITY_STATE_ZIP_CAPTION}</td>
            </tr>
          </tbody>
        </table>

        <p className="px-2 pb-2 pt-1 font-bold">{MEDICAL_RELEASE_AUTHORIZATION}</p>

        {/* Provider authorised to release the records */}
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className={cell}>{release.providerName || ' '}</td>
            </tr>
            <tr>
              <td className={caption}>{MEDICAL_RELEASE_PROVIDER_NAME_CAPTION}</td>
            </tr>
            <tr>
              <td className={`${cell} whitespace-pre-wrap`}>
                {formatProviderContact(release.providerPhone, release.providerFax) || ' '}
              </td>
            </tr>
            <tr>
              <td className={caption}>{MEDICAL_RELEASE_PROVIDER_CONTACT_CAPTION}</td>
            </tr>
          </tbody>
        </table>

        {/* Release to */}
        <div className="mt-4 text-center">
          <p className="font-bold underline">{MEDICAL_RELEASE_TO_HEADING}</p>
          <p>{MEDICAL_RELEASE_TO_NAME}</p>
          {MEDICAL_RELEASE_TO_ADDRESS_LINES.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p className="font-bold">
            EMAIL:{' '}
            <a href={`mailto:${MEDICAL_RELEASE_TO_EMAIL}`} className="text-[#0563C1] underline">
              {MEDICAL_RELEASE_TO_EMAIL}
            </a>
          </p>
          <p className="font-bold">FAX: {MEDICAL_RELEASE_TO_FAX}</p>
        </div>

        {/* Information to be released */}
        <p className={`${heading} mt-2`}>{MEDICAL_RELEASE_INFORMATION_HEADING}</p>
        <div
          className="mt-2 grid gap-x-2 pl-2 sm:pl-9"
          style={{ gridTemplateColumns: 'minmax(0, 3235fr) minmax(0, 2610fr) minmax(0, 2610fr)' }}
        >
          {MEDICAL_RELEASE_INFORMATION_COLUMNS.map((items) => (
            <ul key={items[0]} className="min-w-0 space-y-1.5 break-words">
              {items.map((item) => (
                <li key={item}>*{item}</li>
              ))}
            </ul>
          ))}
        </div>

        {/* Numbered statements — small print on the paper form */}
        <ol className="mt-4 list-decimal space-y-2 pl-8 sm:pl-14" style={{ fontSize: '10px', lineHeight: 1.25 }}>
          {MEDICAL_RELEASE_TERMS.map((term) => (
            <li key={term} className="pl-2">{term}</li>
          ))}
        </ol>
        <p className="mt-2 px-2" style={{ fontSize: '10px' }}>{MEDICAL_RELEASE_ACKNOWLEDGEMENT}</p>

        {/* Signature lines */}
        <div className="mt-6 border-b border-black px-2 pb-0.5">
          <span className="font-bold">{MEDICAL_RELEASE_PRINTED_NAME_LABEL}</span>{' '}
          <span className="ml-1">{release.printedName}</span>
        </div>
        <div className="flex min-h-[52px] flex-wrap items-center border-b border-black px-2 pb-0.5">
          <div className="flex min-w-0 basis-full items-center sm:basis-3/4">
            <span className="font-bold whitespace-nowrap">{MEDICAL_RELEASE_SIGNATURE_LABEL}</span>
            {release.signaturePng ? (
              <img
                src={`data:image/png;base64,${release.signaturePng}`}
                alt={`Signature of ${release.printedName}`}
                className="ml-3 h-11 min-w-0 max-w-[60%] object-contain object-left"
              />
            ) : null}
          </div>
          <div className="whitespace-nowrap">
            <span className="font-bold">{MEDICAL_RELEASE_DATE_LABEL}</span>{' '}
            <span className="ml-1">{formatReleaseDate(release.signedAt)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 font-bold" style={{ color: '#CC99FF' }}>
          <div className="flex justify-between gap-3 sm:pr-10">
            <span>{MEDICAL_RELEASE_FOOTER_TITLE}</span>
            <span className="whitespace-nowrap">Page 1 of 1</span>
          </div>
          <span className="underline">{MEDICAL_RELEASE_FOOTER_WEBSITE}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The surrogate's signed "Release of Medical Records" form. She fills in and
 * signs it in the mobile app (before Form 2); the agency sees the same form
 * here and downloads the PDF to send with record requests.
 */
export default function SurrogateMedicalReleaseView({ userId, onOpenDocumentsTab }: SurrogateMedicalReleaseViewProps) {
  const [release, setRelease] = useState<MedicalRelease | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showSsn, setShowSsn] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      setRelease(await medicalReleaseService.getByUserId(userId));
    } catch (e: any) {
      console.error('Failed to load medical release', e);
      setRelease(null);
      setLoadError(e?.message || 'Could not load the medical release form.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setShowSsn(false);
    load();
  }, [load]);

  const handleDownload = () => {
    if (!release) return;
    setActionError(null);
    try {
      buildMedicalReleasePdf(release).save(medicalReleaseFileName(release));
    } catch (e: any) {
      console.error('Failed to build medical release PDF', e);
      setActionError('Could not create the PDF. Please try again.');
    }
  };

  const handleRemove = async () => {
    if (!release) return;
    if (!window.confirm('Remove this signed release? The surrogate will be asked to fill in and sign the form again in the app.')) return;
    setActionError(null);
    setIsRemoving(true);
    try {
      await medicalReleaseService.remove(release.id);
      setRelease(null);
    } catch (e: any) {
      console.error('Failed to remove medical release', e);
      setActionError(e?.message || 'Could not remove the release. Please try again.');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status + actions */}
      <div className="flex flex-col gap-3 rounded-2xl border border-rose-100/60 bg-white p-4 dark:border-white/5 dark:bg-[#15111f] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Medical release</h2>
          {isLoading ? (
            <Badge color="gray">Loading…</Badge>
          ) : release ? (
            <Badge color="green">Signed {formatReleaseDate(release.signedAt)}</Badge>
          ) : loadError ? (
            <Badge color="red">Unavailable</Badge>
          ) : (
            <Badge color="yellow">Not signed yet</Badge>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {release && (
            <Button size="sm" onClick={handleDownload}>
              <i className="ri-download-2-line mr-1" />
              Download PDF
            </Button>
          )}
          {release && (
            <Button size="sm" variant="outline" color="red" onClick={handleRemove} disabled={isRemoving}>
              <i className="ri-delete-bin-line mr-1" />
              {isRemoving ? 'Removing…' : 'Remove & request new signature'}
            </Button>
          )}
          {onOpenDocumentsTab && (
            <Button size="sm" color="blue" onClick={onOpenDocumentsTab}>
              <i className="ri-folder-open-line mr-1" />
              All documents
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <i className="ri-error-warning-line mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Could not load the medical release form.</p>
            <p className="mt-0.5 text-xs opacity-80">{loadError}</p>
            <button type="button" onClick={load} className="mt-2 cursor-pointer text-xs font-semibold underline">Try again</button>
          </div>
        </div>
      )}

      {actionError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          <i className="ri-error-warning-line flex-shrink-0" />
          {actionError}
        </div>
      )}

      {!isLoading && !loadError && !release && (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-white/10 bg-white dark:bg-[#15111f] p-8 text-center">
          <i className="ri-quill-pen-line text-4xl text-gray-300 dark:text-gray-600" />
          <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">No signed release on file</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            The surrogate hasn't signed the Release of Medical Records yet. The app asks her to complete it before Form 2.
          </p>
        </div>
      )}

      {release && (
        <ReleaseSheet release={release} showSsn={showSsn} onToggleSsn={() => setShowSsn((v) => !v)} />
      )}
    </div>
  );
}
