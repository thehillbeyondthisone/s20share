"""Publish only finished portable viewers to the public spatial library.

Uses standard Git authentication; no token is stored in this repository.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

REMOTE = "https://github.com/thehillbeyondthisone/s20share.git"
FILE_LIMIT = 95 * 1024**2
SITE_LIMIT = 900 * 1024**2


def sha256(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as stream:
        while block := stream.read(8 * 1024**2):
            value.update(block)
    return value.hexdigest()


def write_json(path, value):
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    os.replace(temporary, path)


def stage_scan(repo, delivery, metadata, cover=None):
    """Validate, copy immutable artifacts, then atomically update the catalog."""
    repo, delivery = Path(repo).resolve(), Path(delivery).resolve()
    docs = repo / 'docs'
    if not (docs / 'index.html').is_file():
        raise ValueError('Spatial library site is missing')
    sid = metadata['id']
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}', sid):
        raise ValueError('Invalid public scan identifier')
    if metadata.get('state') != 'package_ready':
        raise ValueError('Only a finished package can be published')
    title = metadata.get('title')
    if not isinstance(title, str) or not title.strip() or len(title) > 300:
        raise ValueError('A scan title is required')
    captured = metadata['captured_date']
    datetime.strptime(captured, '%Y-%m-%d')
    now = datetime.now(timezone.utc).isoformat()
    catalog_path = docs / 'catalog.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    if catalog.get('schema_version') != '1.0' or not isinstance(catalog.get('scans'), list):
        raise ValueError('Unsupported catalog format')
    names = ('index.html', 'viewer-package.zip')
    hashes = {}
    for name in names:
        source = delivery / name
        if source.is_symlink() or not source.is_file() or source.stat().st_size > FILE_LIMIT:
            raise ValueError('Viewer file missing, linked, or too large for GitHub: ' + name)
        hashes[name] = sha256(source)
    if hashes['index.html'] != metadata.get('html_sha256'):
        raise ValueError('Viewer hash differs from the completed run')
    if hashes['viewer-package.zip'] != metadata.get('package_sha256'):
        raise ValueError('Package hash differs from the completed run')
    if cover:
        cover = Path(cover).resolve()
        if cover.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp') or cover.is_symlink() or not cover.is_file() or cover.stat().st_size > 8 * 1024**2:
            raise ValueError('Invalid cover image')
    revision = hashes['index.html'][:16]
    relative = Path('viewers') / sid / revision
    target = (docs / relative).resolve()
    if not target.is_relative_to(docs.resolve()):
        raise ValueError('Viewer path is outside the site')
    existing = next((scan for scan in catalog['scans'] if scan['id'] == sid), None)
    if existing and existing.get('html_sha256') == hashes['index.html'] and existing.get('package_sha256') == hashes['viewer-package.zip'] and not metadata.get('update_metadata'):
        # Preserve titles, review decisions and covers curated in the library.
        for name in names:
            if not (target / name).is_file() or sha256(target / name) != hashes[name]:
                raise ValueError('Published artifact is missing or modified: ' + name)
        return existing
    copies = [(delivery / name, target / name, hashes[name]) for name in names]
    if cover:
        copies.append((cover, target / ('cover' + cover.suffix.lower()), sha256(cover)))
    for source, destination, expected in copies:
        if destination.exists() and sha256(destination) != expected:
            raise ValueError('Existing published revision conflicts: ' + destination.name)
    additions = sum(source.stat().st_size for source, destination, _ in copies if not destination.exists())
    total = sum(path.stat().st_size for path in docs.rglob('*') if path.is_file())
    if total + additions > SITE_LIMIT:
        raise ValueError('Library storage budget exceeded; archive old revisions or use asset storage')
    target.mkdir(parents=True, exist_ok=True)
    for source, destination, expected in copies:
        if not destination.exists():
            temporary = destination.with_name(destination.name + '.partial')
            shutil.copyfile(source, temporary)
            if sha256(temporary) != expected:
                raise ValueError('File changed while copying: ' + source.name)
            os.replace(temporary, destination)
    entry = {
        'id': sid, 'capture_id': str(metadata.get('capture_id', sid)), 'title': title,
        'description': str(metadata.get('description', 'An interactive 3D walkthrough of this captured space.')),
        'captured_date': captured, 'published_at': existing['published_at'] if existing else now,
        'review': 'reviewed' if metadata.get('review') == 'reviewed' else 'preview',
        'tags': [str(tag) for tag in metadata.get('tags', [])][:8],
        'photos': int(metadata.get('photos', 0)),
        'viewpoints': int(metadata.get('viewpoints', 4)),
        'viewer': (relative / 'index.html').as_posix(), 'package': (relative / 'viewer-package.zip').as_posix(),
        'viewer_bytes': (delivery / 'index.html').stat().st_size,
        'package_bytes': (delivery / 'viewer-package.zip').stat().st_size,
        'html_sha256': hashes['index.html'], 'package_sha256': hashes['viewer-package.zip'],
        'cover': (relative / ('cover' + cover.suffix.lower())).as_posix() if cover else
                 (existing.get('cover') if existing and existing.get('html_sha256') == hashes['index.html'] else 'assets/space-placeholder.svg'),
    }
    if existing != entry:
        catalog['scans'] = [scan for scan in catalog['scans'] if scan['id'] != sid] + [entry]
        catalog['scans'].sort(key=lambda scan: scan['captured_date'], reverse=True)
        catalog['updated_at'] = now
        write_json(catalog_path, catalog)
    return entry


def git(repo, *args, timeout=90):
    environment = os.environ.copy()
    environment.update(GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='never')
    result = subprocess.run(['git', '-c', 'credential.interactive=false', '-C', str(repo), *args],
                            capture_output=True, text=True, env=environment, timeout=timeout)
    if result.returncode:
        # Error messages from Git do not include the credential helper response.
        raise RuntimeError('Git ' + args[0] + ' failed: ' + (result.stderr or result.stdout).strip()[-1600:])
    return result.stdout.strip()


@contextmanager
def lock(repo):
    path = repo / '.git' / 's20share-publish.lock'
    try:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        raise RuntimeError('Another publisher is using the repository') from None
    try:
        os.write(descriptor, str(os.getpid()).encode())
        yield
    finally:
        os.close(descriptor)
        path.unlink()


def publish(repo, delivery, metadata, cover=None):
    repo = Path(repo).resolve()
    with lock(repo):
        if git(repo, 'remote', 'get-url', 'origin') != REMOTE:
            raise ValueError('Publisher remote must be the selected s20share repository')
        if git(repo, 'branch', '--show-current') != 'main':
            raise ValueError('Publisher requires the main branch')
        if git(repo, 'status', '--porcelain'):
            raise ValueError('Commit or preserve local repository changes before publishing')
        git(repo, 'fetch', 'origin', 'main')
        git(repo, 'merge', '--ff-only', 'origin/main')
        entry = stage_scan(repo, delivery, metadata, cover)
        git(repo, 'add', '--', 'docs/catalog.json', 'docs/viewers')
        if git(repo, 'diff', '--cached', '--name-only'):
            git(repo, '-c', 'user.name=Yellow Umbrella Publisher', '-c', 'user.email=227703673+thehillbeyondthisone@users.noreply.github.com',
                'commit', '-m', 'Publish walkthrough: ' + metadata['title'])
        git(repo, 'push', 'origin', 'HEAD:main', timeout=180)
        return {'entry': entry, 'commit': git(repo, 'rev-parse', 'HEAD'), 'state': 'pushed'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--delivery', type=Path, required=True)
    parser.add_argument('--metadata', type=Path, required=True)
    parser.add_argument('--cover', type=Path)
    parser.add_argument('--stage-only', action='store_true')
    args = parser.parse_args()
    metadata = json.loads(args.metadata.read_text(encoding='utf-8'))
    value = {'entry': stage_scan(args.repo, args.delivery, metadata, args.cover), 'state':'staged'} if args.stage_only else publish(args.repo, args.delivery, metadata, args.cover)
    print(json.dumps(value, indent=2))


if __name__ == '__main__':
    main()
