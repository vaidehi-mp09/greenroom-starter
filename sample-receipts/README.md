# Sample Receipts — Testing Guide

10 sample receipts for testing the vendor receipt upload and OCR parsing flow.
2 receipts per vendor category: sound, lights, production, hospitality, marketing.

## Files

| File | Vendor | Category | Total | Show |
|---|---|---|---|---|
| `sound-nashville-sound-co.html` | Nashville Sound Co. | Sound | $564.00 | Hollow Branch (May 29) |
| `sound-soundwave-productions.html` | SoundWave Productions | Sound | $793.00 | Telegraph Avenue (Jun 5) |
| `lights-music-city-lighting.html` | Music City Lighting | Lights | $436.00 | Telegraph Avenue (Jun 5) |
| `lights-stagecraft-illumination.html` | Stagecraft Illumination | Lights | $317.00 | Pale Lake (May 22) |
| `production-third-coast.html` | Third Coast Production | Production | $630.00 | Hollow Branch (May 29) |
| `production-crescent-stage-crew.html` | Crescent Stage Crew | Production | $302.00 | Glass Bottle (Jun 12) |
| `hospitality-green-room-catering.html` | Green Room Catering | Hospitality | $421.30 | Hollow Branch (May 29) |
| `hospitality-backstage-provisions.html` | Backstage Provisions | Hospitality | $122.00 | Glass Bottle (Jun 12) |
| `marketing-broad-street-media.html` | Broad Street Media | Marketing | $485.00 | Telegraph Avenue (Jun 5) |
| `marketing-indie-poster-house.html` | Indie Poster House | Marketing | $305.00 | Pale Lake (May 22) |

## How to Use

### Option A — Upload as PDF (tests OCR/pdf-parse path)
1. Open any `.html` file in Chrome or Safari
2. Print → Save as PDF
3. Go to the matching show page in the app
4. Click the camera icon on the matching expense row
5. Upload the PDF — the parser will extract vendor, amount, and category

### Option B — Paste as text (tests regex parser directly)
1. Open the `.html` file, select all visible text, copy
2. Go to the matching show page in the app
3. Click the camera icon on the matching expense row
4. Paste into the "paste receipt text" textarea and click Parse & log

## Recommended Test Flow (reviewer)

1. Open `http://localhost:3000/shows/show_0539` (Hollow Branch — flat deal)
2. Expense table shows placeholder rows for Sound, Production, Hospitality
3. Upload `sound-nashville-sound-co.html` (as PDF) → Sound row populates with $564
4. Upload `production-third-coast.html` (paste text) → Production row populates with $630
5. Upload `hospitality-green-room-catering.html` → Hospitality row populates with $421.30
6. Navigate to `/shows/show_0539/settle` to see the populated worksheet
7. Export to Excel and verify all 3 expense line items appear expanded
