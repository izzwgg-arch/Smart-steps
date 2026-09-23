import { redirect } from 'next/navigation'

/**
 * Retired route - redirects to /forms/visit-attestation
 *
 * This page was backed by the ParentABCData / ParentTrainingSignIn /
 * VisitAttestation tables, which do NOT exist in the production database
 * (verified 2026-09-23 - only FormDocument does), so any real use threw. The
 * ABC variant also still applied one behavior to every row, which the live form
 * no longer does.
 *
 * The working implementation lives under /forms and stores everything in
 * FormDocument. Kept as a redirect so existing links and bookmarks land
 * somewhere that works; the original implementation is in git history.
 */
export default function RetiredFormRoute() {
  redirect('/forms/visit-attestation')
}
