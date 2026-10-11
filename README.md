# Yellow Umbrella Group · Spatial library

Live library: https://thehillbeyondthisone.github.io/s20share/

The `docs/` directory is a static site served by GitHub Pages from `main`.
It contains the branded collection, searchable catalog, downloadable packages,
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

The Martial Arts Studio is marked `milestone: "first-successful"` in the catalog
and stays first in the default collection order. Its cover is rendered from the
cleaned scan. The page shows each scan once; search and sorting appear when the
collection has more than one entry. Retired listings can be removed from the
catalog while their versioned viewer files remain available for recovery.

Each file is limited to 95 MiB and the generated site to 900 MiB, leaving room
within GitHub hosting limits. As the library grows, move large assets to dedicated
storage before exceeding that budget. Old revisions are retained deliberately.

Preview locally with `python -m http.server 8793 --directory docs`.

## Meta Quest test link

`https://thehillbeyondthisone.github.io/s20share/quest/` follows the latest
studio entry marked `quest_preview: true`. The collection offers Meta's official
Web Launch link to send that page to a headset. The viewer offers **Enter VR**
only when immersive WebXR is available and starts it only after a button press.

VR starts at View 4. Right/left triggers advance/go back through the four reviewed
stations; the right stick snap-turns 30 degrees; B exits. Native free locomotion
is disabled. Head tracking remains natural; the room fades when the viewer moves
more than 25 cm from a station, becoming fully obscured at 45 cm. Returning or
changing stations restores it. This is guided navigation, not a collision mesh.
The aligned scan scale is retained, with an estimated floor of Y=-0.76 m.

The cleaned 684,429-splat payload is unchanged. Desktop rendering, the unsupported
browser fallback, and seven simulated XR lifecycle/navigation cases were checked.
Physical Quest 3 performance, controller behavior, floor alignment, and comfort
still need a headset test. Use the test link seated initially and report those
results before describing it as verified on Quest 3.
