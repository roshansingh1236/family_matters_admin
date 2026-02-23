import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { User, UserRole, MatchStatus } from "@/types";
import { X, Plus, Eye, Loader2, AlertCircle, Check, Calendar } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const MATCH_STATUSES: MatchStatus[] = [
  "Proposed",
  "Presented",
  "Accepted",
  "Active",
  "Delivered",
  "Escrow Closure",
  "Cancelled",
  "Completed",
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface CreateMatchDialogProps {
  user: User;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateMatchDialog({ user }: CreateMatchDialogProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // ── Role logic ──────────────────────────────────────────────────────────────
  const isIntendedParent = user.role === "Intended Parent";
  const isSurrogate = user.role === "Surrogate";
  const canCreateMatch = isIntendedParent || isSurrogate;

  const oppositeRole: UserRole = isIntendedParent ? "Surrogate" : "Intended Parent";
  const listLabel = isIntendedParent ? "Select a Surrogate" : "Select an Intended Parent";
  const profileBasePath = isIntendedParent ? "/surrogates" : "/parents";

  // ── State ───────────────────────────────────────────────────────────────────
  const [options, setOptions] = useState<User[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<MatchStatus>("Proposed");
  const [matchScore, setMatchScore] = useState("");
  const [agencyNotes, setAgencyNotes] = useState("");
  const [matchedAt, setMatchedAt] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ── Derived ─────────────────────────────────────────────────────────────────
  const selectedUser = options.find((u) => u.id === selectedId);
  const filteredOptions = options.filter((u) => {
    const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase();
    const email = (u.email ?? "").toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || email.includes(q);
  });
  const canSubmit = !!selectedId && !submitting;

  // ── Close on Escape ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // ── Lock body scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ── Fetch opposite-role users ────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !canCreateMatch) return;

    const fetchOptions = async () => {
      setLoadingOptions(true);
      const { data, error: fetchError } = await supabase
        .from("users")
        .select("id, role, email, first_name, last_name, status")
        .eq("role", oppositeRole);

      if (!fetchError && data) {
        const mapped = data.map((u: any) => ({
          ...u,
          firstName: u.first_name,
          lastName: u.last_name,
        }));
        setOptions(mapped as User[]);
      }
      setLoadingOptions(false);
    };

    fetchOptions();
  }, [open, canCreateMatch, oppositeRole]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getDisplayName = (u: User) =>
    u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.email ?? "Unknown");

  const getInitial = (u: User) =>
    (u.firstName?.charAt(0) ?? u.email?.charAt(0) ?? "?").toUpperCase();

  const resetForm = useCallback(() => {
    setSelectedId("");
    setSearch("");
    setStatus("Proposed");
    setMatchScore("");
    setAgencyNotes("");
    setMatchedAt("");
    setError("");
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    resetForm();
  }, [resetForm]);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);

    const { data: existing } = await supabase
      .from("matches")
      .select("id")
      .eq("intended_parent_id", isIntendedParent ? user.id : selectedId)
      .eq("gestational_carrier_id", isIntendedParent ? selectedId : user.id)
      .maybeSingle();

    if (existing) {
      setError("A match between these two users already exists.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("matches").insert({
      intended_parent_id: isIntendedParent ? user.id : selectedId,
      gestational_carrier_id: isIntendedParent ? selectedId : user.id,
      status,
      match_score: matchScore ? parseFloat(matchScore) : null,
      agency_notes: agencyNotes || null,
      matched_at: matchedAt ? new Date(matchedAt).toISOString() : null,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    handleClose();
  };

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (!canCreateMatch) return null;

  // ── Shared input classes ─────────────────────────────────────────────────────
  const inputCls =
    "w-full px-3 py-2 text-sm rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-transparent bg-black border border-white/10";

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Trigger Button ── */}
      <button
        onClick={() => setOpen(true)}
        disabled={!["To be Matched", "Rematch"].includes(user.status as string)}
        title={
          !["To be Matched", "Rematch"].includes(user.status as string)
            ? `Status must be "To be Matched" or "Rematch" to create a match (current: ${user.status})`
            : "Create a new match"
        }
        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 hover:opacity-90 text-white text-sm font-medium rounded-lg transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
      >
        <Plus size={16} />
        Create a Match
      </button>

      {/* ── Dialog ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600">

            {/* ── Header ── */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-white/20">
              <div>
                <h2 className="text-lg font-semibold text-white">Create a Match</h2>
                <p className="text-sm text-white/70 mt-0.5">
                  {isIntendedParent
                    ? "Select a surrogate to match with this intended parent."
                    : "Select an intended parent to match with this surrogate."}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-white/60 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="overflow-y-auto px-6 py-5 space-y-6">

              {/* ── User List ── */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  {listLabel} <span className="text-red-300">*</span>
                </label>
                <p className="text-xs text-white/50 mb-2">
                  Only users with status{" "}
                  <span className="font-medium text-white/80">"To be Matched"</span> or{" "}
                  <span className="font-medium text-white/80">"Rematch"</span> can be selected.
                </p>

                {/* Search */}
                <div className="relative mb-2">
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`${inputCls} pl-9`}
                  />
                  <svg
                    className="absolute left-3 top-2.5 text-white/40"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </div>

                {loadingOptions ? (
                  <div className="flex items-center gap-2 text-sm text-white/60 py-8 justify-center">
                    <Loader2 size={16} className="animate-spin" />
                    Loading...
                  </div>
                ) : filteredOptions.length === 0 ? (
                  <p className="text-sm text-white/50 py-8 text-center">
                    {search
                      ? `No results for "${search}"`
                      : `No ${isIntendedParent ? "surrogates" : "intended parents"} found.`}
                  </p>
                ) : (
                  <div className="bg-black rounded-xl divide-y divide-white/5 max-h-56 overflow-y-auto border border-white/10">
                    {filteredOptions.map((u) => {
                      const isSelected = selectedId === u.id;
                      return (
                        <div
                          key={u.id}
                          onClick={() => setSelectedId(u.id)}
                          className={`flex items-center justify-between px-4 py-3 transition-colors cursor-pointer hover:bg-white/5 ${
                            isSelected ? "bg-white/10 border-l-4 border-l-white/60" : ""
                          }`}
                        >
                          {/* Avatar + name + email */}
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white/80 shrink-0">
                              {getInitial(u)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white leading-none">
                                {getDisplayName(u)}
                              </p>
                              {u.email && (
                                <p className="text-xs text-white/40 mt-0.5">{u.email}</p>
                              )}
                            </div>
                          </div>

                          {/* Status badge + eye */}
                          <div className="flex items-center gap-3 shrink-0">
                            {u.status && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                                {u.status}
                              </span>
                            )}
                            <button
                              type="button"
                              title="View profile"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/profile-preview/${u.id}`);
                              }}
                              className="text-white/40 hover:text-white transition-colors p-1 rounded"
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Status + Match Score ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-white">
                    Status <span className="text-red-300">*</span>
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MatchStatus)}
                    className={`${inputCls} bg-black`}
                  >
                    {MATCH_STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-gray-900 text-white">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-white">
                    Match Score
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    placeholder="e.g. 87.5"
                    value={matchScore}
                    onChange={(e) => setMatchScore(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* ── Matched At ── */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-white">Matched At</label>
                <div className="relative">
                  <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none z-10" />
                  <input
                    type="datetime-local"
                    value={matchedAt}
                    onChange={(e) => setMatchedAt(e.target.value)}
                    className={`${inputCls} pl-9 [color-scheme:dark]`}
                  />
                </div>
              </div>

              {/* ── Agency Notes ── */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-white">Agency Notes</label>
                <textarea
                  rows={3}
                  placeholder="Add any internal notes about this match..."
                  value={agencyNotes}
                  onChange={(e) => setAgencyNotes(e.target.value)}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* ── Error ── */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-300 bg-red-500/20 border border-red-400/20 px-3 py-2 rounded-lg">
                  <AlertCircle size={15} />
                  {error}
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/20">
              <button
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-black/30 border border-white/20 rounded-lg hover:bg-black/50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                title={!selectedId ? "Please select a user first" : undefined}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-black/40 border border-white/30 rounded-lg hover:bg-black/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    Create Match
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}