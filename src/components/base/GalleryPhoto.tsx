import React, { useEffect, useState } from 'react';

type GalleryPhotoProps = {
  /** The (possibly HEIF) source URL. */
  url: string;
  /** File name — used to detect .heic/.heif when the MIME type is missing. */
  name?: string;
  /** MIME type, when available. */
  type?: string;
  alt?: string;
  className?: string;
};

const isHeif = (name?: string, type?: string) => {
  const t = String(type ?? '').toLowerCase();
  const n = String(name ?? '').toLowerCase();
  return t.includes('heic') || t.includes('heif') || /\.(heic|heif)$/i.test(n);
};

/**
 * Renders an image, transparently converting HEIF/HEIC to a browser-displayable
 * JPEG blob (Chrome/Firefox/Edge can't decode HEIF in <img> natively).
 */
const GalleryPhoto: React.FC<GalleryPhotoProps> = ({ url, name, type, alt, className }) => {
  const [src, setSrc] = useState<string>(isHeif(name, type) ? '' : url);
  const [status, setStatus] = useState<'idle' | 'converting' | 'error'>(
    isHeif(name, type) ? 'converting' : 'idle'
  );

  useEffect(() => {
    if (!isHeif(name, type)) {
      setSrc(url);
      setStatus('idle');
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        setStatus('converting');
        const { default: heic2any } = await import('heic2any');
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
        const blob = await res.blob();
        const converted = (await heic2any({ blob, toType: 'image/jpeg', quality: 0.9 })) as Blob | Blob[];
        const out = Array.isArray(converted) ? converted[0] : converted;
        objectUrl = URL.createObjectURL(out);
        if (!cancelled) {
          setSrc(objectUrl);
          setStatus('idle');
        }
      } catch (err) {
        console.error('HEIF conversion failed:', err);
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, name, type]);

  if (status === 'converting') {
    return (
      <div className={`flex items-center justify-center bg-gray-100 dark:bg-[#15111f] ${className ?? ''}`}>
        <i className="ri-loader-4-line animate-spin text-2xl text-gray-400"></i>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 bg-gray-100 dark:bg-[#15111f] text-gray-400 ${className ?? ''}`}>
        <i className="ri-image-line text-2xl"></i>
        <span className="text-[10px]">Preview unavailable</span>
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
};

export default GalleryPhoto;
