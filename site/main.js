// Progressive enhancement for the landing page; it works without this file.
// Download links default to the releases page on GitHub.
const REPO = 'praneth2580/RIDECORE';
/** RIDECORE's releases: pre-releases tagged ridecore-v<version>, next to TrailCompass's v<version>. */
const TAG_PREFIX = 'ridecore-v';

/** Point every download button straight at the newest APK, with its version and size. */
async function showLatestRelease() {
  const release = (await siteRelease()) ?? (await githubRelease());
  if (!release) return; // Offline or rate-limited: the links still open the releases page.

  const version = `v${release.tag.replace(TAG_PREFIX, '')}`;
  for (const link of document.querySelectorAll('[data-download]')) {
    link.href = release.url;
  }
  const megabytes = (release.size / 1_000_000).toFixed(1);
  for (const meta of document.querySelectorAll('[data-release-meta]')) {
    meta.textContent = `${version} · ${megabytes} MB · Android 6.0+`;
  }
  for (const element of document.querySelectorAll('[data-release-version]')) {
    element.textContent = version;
  }
}

/**
 * The APK this site serves (download/latest.json, published with each
 * release). Downloads from GitHub itself are slow or stall on many mobile
 * networks; this site is served through a CDN.
 */
async function siteRelease() {
  try {
    const response = await fetch('download/latest.json', { cache: 'no-cache' });
    if (!response.ok) return null;
    const latest = await response.json();
    if (typeof latest.apk !== 'string' || !/^download\/[A-Za-z0-9._-]+\.apk$/.test(latest.apk)) {
      return null;
    }
    if (typeof latest.tag !== 'string' || !latest.tag.startsWith(TAG_PREFIX)) return null;
    return { url: new URL(latest.apk, document.baseURI).href, tag: latest.tag, size: latest.size };
  } catch {
    return null;
  }
}

/**
 * Fallback: the newest RIDECORE release on GitHub with an APK. GitHub's
 * "latest release" skips pre-releases, so the list is read instead.
 */
async function githubRelease() {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return null;
    const releases = await response.json();
    for (const release of releases) {
      if (release.draft || !release.tag_name?.startsWith(TAG_PREFIX)) continue;
      const apk = (release.assets ?? []).find((asset) => asset.name.endsWith('.apk'));
      if (apk) return { url: apk.browser_download_url, tag: release.tag_name, size: apk.size };
    }
    return null;
  } catch {
    return null;
  }
}

if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  for (const note of document.querySelectorAll('[data-ios-note]')) note.hidden = false;
}

showLatestRelease();
