# Pending work — read this first, every session

## Template Library (formats-usg/_index.json)
- Extracted 4,608 Word templates: 2557 USG, 1210 CT, 499 XRAY, 245 ECHO, 26 MRI, 64 LAB, 7 EEG.
- **NEXT (USG)**: Wire USG rows into composer quick-select (pathologies) + whole-report picker.
- **NEXT (MRI)**: Copy CT/MRI rows into mri-reports repo (snippet macros / formats library).
- **Wife's NEW templates**: When she brings new ones from the clinic NAS, copy them into `formats-usg/`, then re-run the Python extractor script (see git log for the exact python snippet).

## usg-reports pending
- DICOM picker: thumbnail grid with tick-boxes + "Add N to report" (one-go select)
- Optional: re-stamp finalized reports' stored HTML with new cropped signature

## mri-reports pending
- Worklist filters: modality tabs + date chips (verify after deps fix)
