# Yellow Umbrella Group · Spatial library

Live library: https://thehillbeyondthisone.github.io/s20share/

The `docs/` directory is a static site served by GitHub Pages from `main`.
It contains the branded dashboard, searchable catalog, downloadable packages,
the bounded-pass explainer, and standalone SuperSplat walkthroughs. Each viewer
revision has its own URL; updates retain previously published links.

The catalog contains published walkthroughs only. It refreshes every minute;
it does not claim to show a live connection to the processing PC. A new scan
appears after its package is pushed and GitHub Pages finishes deployment.

## Publish a finished scan

Authenticate this PC once with `gh auth login`, then `gh auth setup-git`.
The local Drive-to-viewer pipeline calls this adapter after its quality checks
and the operator's **Publish publicly** approval for the exact package revision.
The same adapter can be called manually:

```powershell
python tools/publish_scan.py --delivery "PATH_TO_FINISHED_PACKAGE" --metadata "PUBLIC_METADATA.json" --cover "OPTIONAL_COVER.png"
```

Public metadata requires `id`, `state: "package_ready"`, `title`,
`captured_date` (`YYYY-MM-DD`), `html_sha256`, and `package_sha256`.
Optional fields are `capture_id`, `description`, `photos`, `viewpoints`,
`tags`, and `review` (`preview` or `reviewed`). `--stage-only` prepares the
site without committing or pushing. Hashes must match the finished run.

Only `index.html`, `viewer-package.zip`, and an optional cover are copied.
Raw captures, processing logs, local paths and credentials are excluded.
The publisher requires a clean checkout on `main`, fetches before updating,
preserves other catalog entries and curated metadata, then commits and pushes.
A rejected push remains available locally for retry. Concurrent or conflicting
updates are reported instead of overwriting them.

## Review and maintain the collection

Approved scans are published as **Preview**, so their live URL is ready for review.
After checking the walkthrough, change that catalog entry's `review` to
`reviewed` in `docs/catalog.json`, commit, and push. Titles, descriptions and
tags can be edited there too. An automatic retry of an unchanged viewer preserves
those edits. To explicitly replace metadata through the adapter, include
`update_metadata: true` in the input metadata.

Each file is limited to 95 MiB and the generated site to 900 MiB, leaving room
within GitHub hosting limits. As the library grows, move large assets to dedicated
storage before exceeding that budget. Old revisions are retained deliberately.

Preview locally with `python -m http.server 8793 --directory docs`.
