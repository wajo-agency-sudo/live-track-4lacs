# live-track-4lacs

Publieke positiefeed (`positions.json`) voor de Live-track 4 Lacs-kaart.

Een GitHub Actions-workflow (`.github/workflows/track.yml`) haalt elke 5 minuten de Garmin LiveTrack-pagina's op en werkt `positions.json` bij. De LiveTrack-links staan in de repository-secret `LIVETRACK_LINKS` en worden niet gepubliceerd.
