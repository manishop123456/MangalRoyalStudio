# MRS Clean Git History Plan (proposed, NOT executed)

**Date:** 2026-11-22 · **Current repository:** `main` @ `c7de1bc`, 1 commit, **no remote**. Nothing was committed, pushed or rewritten.

## Why
The only commit (`c7de1bc`) contains the dev-seed Admin passwords in 9 files, including the client-side `apps/admin/src/app/page.tsx`. Any push of this history would publish them. The working tree is now clean of them (see `MRS_CREDENTIAL_REMEDIATION_REPORT.md`).

## Already done (non-destructive)
- **Original metadata archived:** `~/MRS-Secure-Backups/git-history/mangalroyalstudio-original-git-c7de1bc-20261122T092912Z.tgz` (mode 600, dir 700), SHA-256 `0c63f15ffc86a8f3171b25b458780992ceb615b364c83d37fdbc03098c8e1adb`. **Never push from it**; keep it offline as an audit record.
- Deployed-staging source snapshot: `~/MRS-Secure-Backups/source-snapshots/staging-deployed-20261122T063250Z.tgz` (`4537dec9…`).
- `.gitignore` excludes `.env*` (except `.env.example`), dumps/backups, keys/certificates, credential exports, data folders, asset inboxes, the pricing workbook, `.next*`, release evidence and root CSVs (verified with `git check-ignore -v`).

## Preconditions (owner)
1. Rotate the 3 staging Admin passwords and the Razorpay test key (procedures in the remediation report).
2. Resolve the HOLD/REVIEW items in `MRS_FINAL_COMMIT_REVIEW.md`: redact the VPS IP (7 reports) and the owner's personal email (6 reports); confirm 3 phone-like numbers are fake.
3. Approve the final file list.

## Recommended method: a brand-new repository directory (no old objects at all)
This leaves the existing repository untouched as a local archive and creates history that never contained the credentials.
```bash
SRC="/Users/macbook/Documents/mangal royal studio/mangalroyalstudio"
NEW="/Users/macbook/Documents/mangal royal studio/mangalroyalstudio-clean"
mkdir "$NEW" && cd "$NEW" && git init -b main
# 1. Copy exactly the reviewed file list (approved list = tracked-to-keep + approved new files)
( cd "$SRC" && git ls-files --cached --others --exclude-standard ) > /tmp/mrs-files.txt   # then remove HOLD/excluded lines
rsync -a --files-from=/tmp/mrs-files.txt "$SRC/" "$NEW/"
cp "$SRC/.gitignore" "$NEW/.gitignore"
# 2. Gates before the first commit (must all be empty / pass)
git add -A
git diff --cached --name-only | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$'          # expect nothing
git grep --cached -nIE -- '-----BEGIN [A-Z ]*PRIVATE KEY|rzp_live_[A-Za-z0-9]{14}|shpat_|AKIA[0-9A-Z]{16}' # expect only known fake test fixtures
git grep --cached -c -F -f /path/to/local-only-list-of-old-passwords.txt                            # expect nothing (file kept OUTSIDE the repo, deleted after)
npm ci && npm run typecheck && npm test && npm run test --workspace=@mrs/storefront && npm run build
# 3. First commit (only after the gates pass and the owner approves)
git commit -m "Initial clean import of Mangal Royal Studio platform"
```
Then add the remote and push **only** from `$NEW`.

**Alternative (same repository, destructive):** `git checkout --orphan clean-main` → `git rm -r --cached .` → add the approved list → commit → `git branch -D main` → `git branch -m main` → `git reflog expire --expire=now --all && git gc --prune=now`. Use this only with explicit approval and only after verifying the archive above; it permanently removes the old objects from this directory.

## After the fresh history exists
- Push only the new history; never add the old repository as a remote or merge from it.
- Optional: add a pre-commit secret scanner (e.g. gitleaks) and keep `credential-hygiene.test.ts` in CI.
