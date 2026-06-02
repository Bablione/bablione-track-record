# POL — public track record

Static viewer for a public, hash-chained snapshot of trading activity.

## Files

```
index.html        page shell
style.css         styles
app.js            fetches data/*.json and renders the page
data/
  trades.json     sanitized trade list (newest first)
  summary.json    headline numbers + per-coin / per-day breakdowns
  runs.json       compound-run archive (post-mortem)
  manifest.json   { snapshot_at, prev_hash, this_hash, files: {...} }
```

## Publishing

The bot writes these files via `python3 -m pol.tools.publish_track_record --write`.
Daily cadence by default; set `TRACK_RECORD_CADENCE=per_trade` for live mode.

## Hash chain

`manifest.this_hash = sha256(trades.json || summary.json || runs.json)` (UTF-8
bytes, in that order, files written with `json.dumps(sort_keys=True, indent=2)`
for deterministic encoding).

`manifest.prev_hash` is the previous snapshot's `this_hash`. Walk the commit
history of this repo to verify the chain.

## What's redacted

See `summary.redaction_note`. Slugs ARE published so anyone can independently
verify each trade outcome on polymarket.com. Strategy parameters, entry
thresholds, internal state, and missed-signal logs are not published.
