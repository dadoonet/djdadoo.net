#!/usr/bin/env bash
# rename-gcs-buckets.sh
#
# Renames audio files in the GCS bucket to match the episode directory structure:
#   OLD: gs://djdadoo/2025-02-06-TouraineTech.mp3
#   NEW: gs://djdadoo/2025/2025-02-06-touraine-tech-2025.mp3
#
# On success, removes audio_url from the episode's index.md frontmatter
# (the URL becomes implicit from the directory structure).
#
# Usage:
#   ./rename-gcs-buckets.sh           # dry-run (shows what would happen)
#   ./rename-gcs-buckets.sh --apply   # actually rename files and remove audio_url

set -euo pipefail

BUCKET="gs://djdadoo"

# ── Preflight checks ──────────────────────────────────────────────────────────
echo "==> Checking gsutil..."

if ! command -v gsutil &>/dev/null; then
  echo "  ERROR  gsutil not found. Install the Google Cloud SDK and retry." >&2
  exit 1
fi

if ! gsutil ls "${BUCKET}" &>/dev/null; then
  echo "  ERROR  Cannot list ${BUCKET}." >&2
  echo "         Make sure you are authenticated (gcloud auth login) and have read access." >&2
  exit 1
fi

echo "  OK     Connected and bucket is readable."
echo ""
# ─────────────────────────────────────────────────────────────────────────────
CONTENT_DIR="$(cd "$(dirname "$0")" && pwd)/content/mixes"
DRY_RUN=true

if [[ "${1:-}" == "--apply" ]]; then
  DRY_RUN=false
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "==> Dry-run mode — no files will be renamed. Pass --apply to execute."
else
  echo "==> Apply mode — files will be renamed in GCS and audio_url removed from frontmatter."
fi
echo ""

renamed=0
skipped=0
errors=0

while IFS= read -r index_md; do
  dir=$(dirname "$index_md")
  slug=$(basename "$dir")
  year=$(basename "$(dirname "$dir")")

  old_url=$(grep '^audio_url:' "$index_md" | sed 's/^audio_url: *"\(.*\)"/\1/')

  if [[ -z "$old_url" ]]; then
    echo "  SKIP    (audio_url already removed)  $(basename "$dir")"
    (( skipped++ )) || true
    continue
  fi

  new_url="${year}/${slug}.mp3"

  if [[ "$old_url" == "$new_url" ]]; then
    echo "  CLEAN   ${old_url}  (already correct in GCS, removing audio_url)"
    if [[ "$DRY_RUN" == "false" ]]; then
      grep -v '^audio_url:' "$index_md" > "$index_md.tmp" && mv "$index_md.tmp" "$index_md"
      (( renamed++ )) || true
    else
      (( renamed++ )) || true
    fi
    continue
  fi

  echo "  RENAME  ${old_url}  →  ${new_url}"

  if [[ "$DRY_RUN" == "false" ]]; then
    if gsutil mv "${BUCKET}/${old_url}" "${BUCKET}/${new_url}" 2>/dev/null; then
      grep -v '^audio_url:' "$index_md" > "$index_md.tmp" && mv "$index_md.tmp" "$index_md"
      (( renamed++ )) || true
    else
      echo "  ERROR   gsutil mv failed for ${old_url}" >&2
      (( errors++ )) || true
    fi
  else
    (( renamed++ )) || true
  fi

done < <(find "$CONTENT_DIR" -name "index.md" | sort)

echo ""
echo "==> Summary: ${renamed} to process, ${skipped} already done, ${errors} errors."
if [[ "$DRY_RUN" == "true" ]]; then
  echo "    Run with --apply to execute."
fi
