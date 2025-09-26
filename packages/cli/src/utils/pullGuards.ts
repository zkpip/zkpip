// ESM, strict TS, no "any" — hardened guards for vectors pull.

function fail(code: string, msg: string): never {
  const err = new Error(msg);
  (err as Error & { code: string }).code = code;
  throw err;
}

export function normalizeSourceUri(raw: string, allowHttp: boolean): URL {
  // 🔒 Early raw-string precheck to catch traversal even before URL parsing.
  // This is intentionally *very* strict and case-insensitive.
  if (raw.startsWith('file://')) {
    const lower = raw.toLowerCase();
    if (
      lower.includes('/../') ||
      lower.includes('/./') ||
      lower.includes('%2e%2e') || // ".." encoded
      lower.includes('%2e/') ||   // "./" encoded
      lower.includes('/%2e')      // "/." encoded
    ) {
      fail('ZK_CLI_ERR_PATH_TRAVERSAL', 'Path traversal is not allowed.');
    }
  }

  const u = new URL(raw);

  if (u.protocol === 'http:') {
    if (!allowHttp) {
      fail('ZK_CLI_ERR_HTTP_DISABLED', 'HTTP is disabled. Use --allow-http to enable.');
    }
    return u;
  }
  if (u.protocol === 'https:') return u;

  if (u.protocol === 'file:') {
    // file://<host>/... is disallowed; only file:///absolute is allowed.
    if (u.host && u.host !== '') {
      fail('ZK_CLI_ERR_FILE_HOST', 'file:// must not include a host; use file:///absolute/path');
    }
    if (!u.pathname.startsWith('/')) {
      fail('ZK_CLI_ERR_FILE_RELATIVE', 'file:// must use an absolute path (file:///absolute/path)');
    }

    // Decode once so %2e / %2e%2e become "." / ".."
    const dec = decodeURIComponent(u.pathname);

    // 🔒 Segment-based dot check (definitive)
    const segs = dec.split('/');
    if (segs.some(s => s === '.' || s === '..')) {
      fail('ZK_CLI_ERR_PATH_TRAVERSAL', 'Path traversal is not allowed.');
    }

    return u;
  }

  fail('ZK_CLI_ERR_PROTOCOL', `Unsupported protocol: ${u.protocol}`);
}
