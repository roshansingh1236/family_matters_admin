import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../base/Button';

interface AgencyApprovalToggleProps {
  /** users.id (Supabase Auth UID). */
  userId: string;
  /** Current approval state pulled from users.agency_approved. */
  approved: boolean;
  /** Called after a successful Supabase update. */
  onChange?: (approved: boolean) => void;
  /** Called if the Supabase update fails. */
  onError?: (err: unknown) => void;
}

/**
 * Button the agency staff uses to approve (or revoke approval for) a user.
 *
 * Flipping `users.agency_approved` gates the "Complete Profile",
 * "Pending Match", and "Trust Account" sections on the mobile app
 * dashboards — without approval the app shows a waiting card instead.
 */
const AgencyApprovalToggle: React.FC<AgencyApprovalToggleProps> = ({
  userId,
  approved,
  onChange,
  onError,
}) => {
  const [isSaving, setIsSaving] = useState(false);

  const toggle = async () => {
    setIsSaving(true);
    const next = !approved;
    try {
      const { error } = await supabase
        .from('users')
        .update({
          agency_approved: next,
          agency_approved_at: next ? new Date().toISOString() : null,
        })
        .eq('id', userId);
      if (error) throw error;
      onChange?.(next);
    } catch (err) {
      console.error('Failed to update agency_approved', err);
      onError?.(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (approved) {
    return (
      <Button
        variant="outline"
        onClick={toggle}
        disabled={isSaving}
        className="!border-emerald-500/40 !text-emerald-400"
      >
        <i className={`ri-${isSaving ? 'loader-4-line animate-spin' : 'shield-check-line'} mr-2`}></i>
        {isSaving ? 'Saving…' : 'Approved — Revoke'}
      </Button>
    );
  }

  return (
    <Button variant="primary" onClick={toggle} disabled={isSaving}>
      <i className={`ri-${isSaving ? 'loader-4-line animate-spin' : 'check-double-line'} mr-2`}></i>
      {isSaving ? 'Approving…' : 'Approve for Matching'}
    </Button>
  );
};

export default AgencyApprovalToggle;
