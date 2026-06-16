#!/usr/bin/env pwsh
# proximap demo - a highlight reel against live OpenStreetMap (no API keys).
#
# Run from the repo root:
#   npm install ; npm run build      # once, if you haven't built yet
#   pwsh examples/demo.ps1

$cli = Join-Path $PSScriptRoot '..\packages\cli\dist\index.js'
if (-not (Test-Path $cli)) {
  Write-Host "CLI build not found. From the repo root run:  npm install ; npm run build" -ForegroundColor Yellow
  exit 1
}

# A 'proximap' shortcut so the printed commands match what runs. To get the bare
# 'proximap' command everywhere: cd packages/cli ; npm link
function proximap { & node $cli @args }

function Step([string]$title, [string[]]$cmd) {
  Write-Host ""
  Write-Host ('=' * 74) -ForegroundColor DarkGray
  Write-Host "  $title" -ForegroundColor Cyan
  Write-Host "  > proximap $($cmd -join ' ')" -ForegroundColor DarkGray
  Write-Host ('=' * 74) -ForegroundColor DarkGray
  proximap @cmd
}

Write-Host "proximap demo - live OpenStreetMap data, no API keys." -ForegroundColor Green
Write-Host "Each step makes a few rate-limited requests; the whole reel takes ~1 minute." -ForegroundColor Green

Step 'Walkability: how well-served is this address? (0-100 + breakdown)' `
  @('score', 'Brandenburg Gate, Berlin')

Step "Gap detection: what is MISSING nearby (framed as 'not found in OSM')" `
  @('gaps', 'Brandenburg Gate, Berlin', '--threshold', '1000')

Step 'Travel-time: nearest cafes by real WALKING time (key-free Valhalla)' `
  @('near', 'Alexanderplatz, Berlin', '-c', 'cafe', '--by', 'travel-time', '--radius', '600', '--limit', '6')

Step 'Reachability: which groceries are within a 12-minute walk? (isochrone)' `
  @('reachable', 'Alexanderplatz, Berlin', '--within', '12min', '-c', 'grocery')

Step 'Errand planner: shortest trip hitting a pharmacy AND atm AND supermarket' `
  @('errands', 'Alexanderplatz, Berlin', '-c', 'pharmacy', '-c', 'atm', '-c', 'supermarket', '--radius', '1500')

Step 'Facets + accessibility: vegan, does takeaway, step-free first' `
  @('near', 'Kreuzberg, Berlin', '-c', 'food', '--filter', 'diet=vegan', '--filter', 'takeaway', '--accessible', '--radius', '1200', '--limit', '6')

Step 'Compare two neighbourhoods by access to what you care about' `
  @('compare', 'Prenzlauer Berg, Berlin', 'Marzahn, Berlin', '--weights', 'grocery=3,transport=2,food=2,park=1')

Step 'Disambiguation: an ambiguous name returns candidates, not a wrong guess' `
  @('geocode', 'Springfield', '-n', '4')

Write-Host ""
Write-Host "Done. Map data (c) OpenStreetMap contributors, ODbL." -ForegroundColor Green
Write-Host "More: proximap --help  |  proximap <command> --help" -ForegroundColor DarkGray
