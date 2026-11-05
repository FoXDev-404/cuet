# OCR pipeline

This folder holds the scripts that turn the PaddleOCR-VL exports into the
previous-year practice library used by the site. The generated library is
committed; the raw OCR exports are archived outside the repository.

## Inputs

- `OCR DATA/*.json` and `OCR DATA/*.md` — raw OCR exports (layout and text).
  These are archived outside the repo and ignored by git. Restore them into
  `tools/ocr/OCR DATA/` before rebuilding the library from source scans.
- `OCR DATA/_pages/` and `OCR DATA/_images/` — generated page/crop caches, ignored by git
- `verified_keys.json` — reviewed answer keys used by the builder

## Commands

Run from the repository root:

```sh
python tools/ocr/_download_ocr_pages.py
python tools/ocr/_download_ocr_images.py
python tools/ocr/_build_local_papers.py --write
python tools/ocr/_validate_library.py
```

`_composite_sheets.py` is a helper for composing question sheets from the generated
library. Outputs are written to `src/data/local-papers/` and `public/local-papers/`.

## What was already built

The generated library has been built and committed. A second import path handles
the normalized PaddleOCR-VL `CUET_JSON_OUTPUT` bundle (180 papers, 8,366
questions) without the page/image caches:

```sh
node scripts/import-cuet-json-output.mjs --dataset /path/to/CUET_JSON_OUTPUT --dry-run
node scripts/import-cuet-json-output.mjs --dataset /path/to/CUET_JSON_OUTPUT
```

The converter keeps only printed, option-valid answers, rejects structurally
broken OCR rows, skips existing curated slugs, and treats the bundle's
model-generated explanations as unreviewed (not imported by default). See
`docs/DATASET_IMPORT_2026-11-06.md` for the 2026-11-06 run and counts.
