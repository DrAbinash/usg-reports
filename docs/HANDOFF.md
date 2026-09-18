# Pending work — read first, every session

## Template library (formats-usg/)
- _index.json = extracted text of all .doc/.docx, classified USG/CT/MRI/XRAY/ECHO/EEG/LAB
- NEXT: wire USG rows into composer quick-select + whole-report picker (reuse /api/usg/templates)
- NEXT: copy CT+MRI rows into mri-reports (snippet macros / formats library)
- Wife's NEW clinic-NAS templates: copy into formats-usg/, re-run extractor (see git log for the python)

## usg-reports pending
- DICOM picker: thumbnail grid + tick-boxes + "Add N to report"
- Trial-expiry date on CREATE-clinic form
- Optional: re-stamp finalized reports with cropped signature

## mri-reports pending
- Verify worklist filters (modality tabs + date chips) after 18-Sep deps fix
