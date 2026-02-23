import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { User, UserRole, MatchStatus } from "@/types";
import { X, Plus, Eye, Loader2, AlertCircle, Check, Calendar } from "lucide-react";
import ProfileDetailDialog from "./ProfileDetailDialog";

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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<MatchStatus>("Proposed");
  const [matchScore, setMatchScore] = useState("");
  const [agencyNotes, setAgencyNotes] = useState("");
  const [matchedAt, setMatchedAt] = useState("");

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [previewUser, setPreviewUser] = useState<{ id: string; role: any } | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const selectedUser = options.find((u) => u.id === selectedId);
  const canSubmit = !!selectedId && !submitting;
  const pageSize = 20;

  // ── Debounce Search ──────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
      setHasMore(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

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

    const fetchOptions = async (isInitial = false) => {
      if (isInitial) {
        setLoadingOptions(true);
      } else {
        setLoadingMore(true);
      }

      let query = supabase
        .from("users")
        .select("id, role, email, first_name, last_name, status", { count: "exact" })
        .eq("role", oppositeRole)
        .in("status", ["Available", "To be Matched", "Rematch"]);

      if (debouncedSearch) {
        query = query.or(
          `first_name.ilike.%${debouncedSearch}%,last_name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`
        );
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error: fetchError, count } = await query
        .range(from, to)
        .order("first_name", { ascending: true });

      if (!fetchError && data) {
        const mapped = data.map((u: any) => ({
          ...u,
          firstName: u.first_name,
          lastName: u.last_name,
        }));

        setOptions((prev) => (page === 0 ? mapped : [...prev, ...mapped]));
        setHasMore(count ? from + data.length < count : data.length === pageSize);
      }

      setLoadingOptions(false);
      setLoadingMore(false);
    };

    fetchOptions(page === 0);
  }, [open, canCreateMatch, oppositeRole, debouncedSearch, page]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getDisplayName = (u: User) =>
    u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.email ?? "Unknown");

  const getInitial = (u: User) =>
    (u.firstName?.charAt(0) ?? u.email?.charAt(0) ?? "?").toUpperCase();

  const resetForm = useCallback(() => {
    setSelectedId("");
    setSearch("");
    setDebouncedSearch("");
    setPage(0);
    setHasMore(true);
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
    "w-full px-3 py-2 text-sm rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-transparent bg-white dark:bg-black border border-gray-200 dark:border-white/10";

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Trigger Button ── */}
      <button
        onClick={() => setOpen(true)}
        disabled={!["To be Matched", "Rematch", "Available"].includes(user.status as string)}
        title={
          !["To be Matched", "Rematch", "Available"].includes(user.status as string)
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
          <div className="relative z-10 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">

            {/* ── Header ── */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create a Match</h2>
                <p className="text-sm text-gray-500 dark:text-white/70 mt-0.5">
                  {isIntendedParent
                    ? "Select a surrogate to match with this intended parent."
                    : "Select an intended parent to match with this surrogate."}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 dark:text-white/60 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="overflow-y-auto px-6 py-5 space-y-6">

              {/* ── User List ── */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
                  {listLabel} <span className="text-red-500 dark:text-red-300">*</span>
                </label>
                <p className="text-xs text-gray-500 dark:text-white/50 mb-2">
                  Only users with status{" "}
                  <span className="font-medium text-gray-700 dark:text-white/80">"Available"</span>,{" "}
                  <span className="font-medium text-gray-700 dark:text-white/80">"To be Matched"</span> or{" "}
                  <span className="font-medium text-gray-700 dark:text-white/80">"Rematch"</span> can be selected.
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
                    className="absolute left-3 top-2.5 text-gray-400 dark:text-white/40"
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
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/60 py-8 justify-center">
                    <Loader2 size={16} className="animate-spin" />
                    Loading...
                  </div>
                ) : options.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-white/50 py-8 text-center">
                    {search
                      ? `No results for "${search}"`
                      : `No ${isIntendedParent ? "surrogates" : "intended parents"} found.`}
                  </p>
                ) : (
                  <div className="bg-gray-50 dark:bg-black rounded-xl divide-y divide-gray-100 dark:divide-white/5 max-h-56 overflow-y-auto border border-gray-200 dark:border-white/10">
                    {options.map((u) => {
                      const isSelected = selectedId === u.id;
                      return (
                        <div
                          key={u.id}
                          onClick={() => setSelectedId(u.id)}
                          className={`flex items-center justify-between px-4 py-3 transition-colors cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 ${
                            isSelected ? "bg-blue-50 dark:bg-white/10 border-l-4 border-l-blue-600 dark:border-l-white/60" : ""
                          }`}
                        >
                          {/* Avatar + name + email */}
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-sm font-semibold text-gray-600 dark:text-white/80 shrink-0">
                              {getInitial(u)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white leading-none">
                                {getDisplayName(u)}
                              </p>
                              {u.email && (
                                <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">{u.email}</p>
                              )}
                            </div>
                          </div>

                          {/* Status badge + eye */}
                          <div className="flex items-center gap-3 shrink-0">
                            {u.status && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-white/60">
                                {u.status}
                              </span>
                            )}
                            <button
                              type="button"
                              title="View profile"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewUser({ id: u.id, role: u.role });
                              }}
                              className="text-gray-400 hover:text-blue-600 dark:text-white/40 dark:hover:text-white transition-colors p-1 rounded"
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {hasMore && (
                      <div className="p-3 bg-white dark:bg-black sticky bottom-0 border-t border-gray-100 dark:border-white/5">
                        <button
                          type="button"
                          onClick={() => setPage((prev) => prev + 1)}
                          disabled={loadingMore}
                          className="w-full py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          {loadingMore ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Loading...
                            </>
                          ) : (
                            "Load More"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Status + Match Score ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-white">
                    Status <span className="text-red-500 dark:text-red-300">*</span>
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MatchStatus)}
                    className={`${inputCls} bg-white dark:bg-black`}
                  >
                    {MATCH_STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-white">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-white">Matched At</label>
                <div className="relative">
                  <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/50 pointer-events-none z-10" />
                  <input
                    type="datetime-local"
                    value={matchedAt}
                    onChange={(e) => setMatchedAt(e.target.value)}
                    className={`${inputCls} pl-9 dark:[color-scheme:dark]`}
                  />
                </div>
              </div>

              {/* ── Agency Notes ── */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-white">Agency Notes</label>
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
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-black/20">
              <button
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-white bg-white dark:bg-black/30 border border-gray-200 dark:border-white/20 rounded-lg hover:bg-gray-50 dark:hover:bg-black/50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                title={!selectedId ? "Please select a user first" : undefined}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 border border-blue-700 dark:border-blue-400 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
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
      {/* Profile Detail Dialog */}
      {previewUser && (
        <ProfileDetailDialog
          userId={previewUser.id}
          role={previewUser.role}
          onClose={() => setPreviewUser(null)}
        />
      )}
    </>
  );
}