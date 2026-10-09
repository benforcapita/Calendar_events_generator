# Local-first Calendar Events Studio

Goal: turn explicit event details into editable, locally saved events and portable ICS files, without credentials or calendar-account access.

Architecture: React editor and event list; a validated event model using Temporal for timezone conversion; RFC 5545 serialization and a constrained ICAL.js importer; versioned local storage. UTC is used on export for timed events, with the original display zone carried in an optional extension. All-day dates stay date-only, with an exclusive end internally and inclusive last-day label in the editor.

Implementation sequence:
- Test and implement strict date/schema validation, ambiguous/nonexistent local times, explicit structured parsing and edit identity preservation.
- Test and implement text escaping, UTF-8 line folding, all-day boundaries and atomic supported-subset ICS import/export.
- Test and implement resilient versioned storage, local editor/list/search, import review and download controls.
- Verify typecheck, lint, unit/component tests, native-cloud desktop/mobile Chromium flows and exact-head CI. Independently review before declaring complete.

Constraints: no external AI/provider calls or key reads; no calendar writes/invitations; no production deployment. Unsupported import features must cause a useful error, not silent data loss. Arbitrary natural language is outside the local parser's supported grammar.

Review focus: DST folds and gaps; all-day year/leap-day boundaries; Unicode/property injection; repeated edits/import duplicates; blocked/corrupt browser storage and small-screen keyboard navigation.
