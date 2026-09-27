---
target: resources/views/pdf/asset-labels.blade.php
total_score: 12
max_score: 20
na_heuristics: 1,3,7,9,10
p0_count: 1
p1_count: 2
timestamp: 2026-09-27T04-26-44Z
slug: resources-views-pdf-asset-labels-blade-php
---
Method: dual-agent (A: design-review agent · B: detector+browser-evidence agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | n/a | no async operation on printed paper |
| 2 | Match System / Real World | 3/4 | BMD terminology & kelurahan/kecamatan header logic correct |
| 3 | User Control and Freedom | n/a | no undo on a physical sticker |
| 4 | Consistency and Standards | 3/4 | internally consistent grid, not tied to app visual tokens |
| 5 | Error Prevention | 1/4 | unbounded asset name length; QR uses weakest EC level |
| 6 | Recognition Rather Than Recall | 2/4 | 6.2-7.2pt text & 13.5mm emblem risk illegibility at arm's length / B&W photocopy |
| 7 | Flexibility and Efficiency | n/a | not applicable to a static tag |
| 8 | Aesthetic and Minimalist Design | 3/4 | clean 3-column grid, proportionate for 83x25mm |
| 9 | Error Recovery | n/a | a printed label cannot self-recover |
| 10 | Help and Documentation | n/a | not applicable |
| **Total** | | **12/20** | **Acceptable (60%)** |

## Design Specificity Verdict

Authored for the specific domain (correct BMD terminology, real city emblem, QR resolving to the real `assets.show` route, and a newly-added kelurahan-vs-kecamatan header distinction) but only ever visually verified against one short demo asset name ("Laptop Dell Latitude 5420"), not the domain's actual long BMD naming convention.

Deterministic scan: `detect.mjs` returned 0 findings (exit 0) — expected, since it targets generic responsive-web smells irrelevant to a fixed-size mm print artifact.

Visual overlay: unavailable (target is a native PDF viewer, not a scriptable DOM page); substituted with direct multi-zoom visual inspection, which found no overlap/misalignment, a crisp QR with adequate quiet zone, and a sharp emblem up to 175% zoom.

## Overall Impression

Structurally sound and domain-specific, but every layout decision has only been tested against one short name. The fixed `height: 25mm` row (down from an earlier 38mm) will break under the domain's actual long BMD names, and since labels print 2-per-row, one long name misaligns the whole row on a shared sheet.

## What's Working

1. Kelurahan/kecamatan-aware header — correctly differentiates "INVENTARIS {Kelurahan} · KECAMATAN SAGULUNG" vs "INVENTARIS Kecamatan Sagulung" depending on asset ownership.
2. Print-pipeline discipline — `isRemoteEnabled(false)` + base64 data URIs for both emblem and QR remove any network-fetch failure risk during unattended batch printing.
3. QR technical soundness — crisp modules, adequate quiet zone, no border-crowding, confirmed across zoom levels.

## Priority Issues

**[P0] Long asset names can break the fixed-height row across a whole print sheet**
- Why it matters: `.asset-name`/`.asset-code` have `word-break: break-word` with no `max-height`/`overflow`, while CSS `height` on table cells is a floor, not a ceiling. Real BMD names run 40-70+ characters; since labels print 2-per-row, one long name misaligns the whole row against its neighbor.
- Fix: `Str::limit()` server-side before the view, or `overflow:hidden` plus a shrink-to-fit font tier. Test against the longest real `nama_aset` in the DB.
- Suggested command: /impeccable harden

**[P1] City emblem likely illegible once photocopied in black-and-white**
- Why it matters: A detailed full-color crest at 13.5mm with no monochrome-safe variant risks collapsing into a gray blob under routine B&W office photocopying.
- Fix: De-emphasize the emblem in favor of the bold "INVENTARIS ..." text, or commission a simplified high-contrast crest for this label size.
- Suggested command: /impeccable polish

**[P1] QR points at an auth-gated route with no fallback**
- Why it matters: `assets.show` sits under `Route::middleware('auth')` (confirmed in routes/web.php); an unauthenticated scanner is bounced to a login screen instead of the asset.
- Fix: Confirm this is intentional; otherwise verify post-login redirect returns to the asset, or add a minimal public read-only resolution view.
- Suggested command: /impeccable harden

**[P2] QR defaults to the weakest error-correction tier**
- Why it matters: `QrCodeService::pngDataUri()` doesn't pass an `ErrorCorrectionLevel`, so BaconQrCode defaults to `L()` (~7% tolerance) — confirmed in vendor source. These tags live for years on scuffed, faded, peeling surfaces.
- Fix: Pass `ErrorCorrectionLevel::Q()` or `H()` explicitly in `forAsset()`.
- Suggested command: /impeccable harden

**[P3] No cut guides for hand-trimmed sheets**
- Why it matters: Staff hand-cut labels with scissors; no crop marks exist, and the QR side has the thinnest safety margin.
- Fix: Add a thin dashed trim guide outside each label's border, or increase QR-side padding.
- Suggested command: /impeccable polish

## Persona Red Flags

**Jordan (first-time label-sticker)**: No visual cue near the QR signals it's functional rather than decorative — the REG-code caption that used to sit there was removed per an earlier request, leaving the QR completely unlabeled.

**Riley (real/extreme data)**: Long BMD names — the domain's normal case, not an edge case — are exactly where P0 breaks.

**Sam (low vision)**: 6.2-7.2pt body text and a 5.2pt header (kelurahan variant) leave very little room to read the tag directly off the object; the QR-linked page isn't an equivalent substitute (needs phone + login + network).

## Minor Observations

- No "scan me" affordance near the QR.
- `table-layout: fixed` was removed from `.label` in the latest revision — currently renders fine for short names, but makes column widths more content-sensitive, compounding P0 risk.
- Zero detector findings is not a quality signal here (detector targets generic web-page smells, not print artifacts).

## Questions to Consider

1. If this label must stay valid for years even as routes/domains change, should the QR encode a stable identifier resolved dynamically instead of today's literal URL?
2. If the emblem likely degrades to a gray blob under B&W photocopying anyway, would that width be better spent enlarging the name/code, letting the bold "INVENTARIS" text alone carry the official signal?
3. Since long BMD names are the domain norm, should the label prioritize the BMD code (the real audit key) at maximum legible size, treating the name as a QR-scan away — matching how the audit process itself actually keys on the code?
