/**
 * POST /api/publish — push the saved content live by rebuilding the marketing site.
 *
 * WHY THIS EXISTS AT ALL
 * earthlingaidtech.com is a static Astro site on GitHub Pages. Content edited in this console is
 * stored in Neon, but the visitor never talks to Neon — the site's prebuild step pulls
 * /api/content into src/data/content.json at BUILD time. So "save" and "publish" are two different
 * events: saving changes the database, publishing regenerates the HTML. This endpoint is the
 * bridge, and all it does is ask GitHub to run the existing deploy workflow.
 *
 * HOW THE TRIGGER WORKS
 * We POST a `repository_dispatch` with event_type "publish-content" to the repo. The Pages
 * workflow (.github/workflows/deploy.yml) lists that event alongside push and workflow_dispatch,
 * so the dispatch runs the exact same build-and-deploy path as a normal commit — no second,
 * divergent deploy pipeline to keep in sync. GitHub answers 204 immediately; the build itself
 * takes minutes, which is why the response tells the operator to wait rather than pretending the
 * site is already updated.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * SETUP — creating the token (one time, and entirely optional; see the degradation note below)
 *
 *   1. GitHub → your avatar → Settings → Developer settings → Personal access tokens →
 *      Fine-grained tokens → "Generate new token".
 *   2. Resource owner: avinrique.  Repository access: "Only select repositories" →
 *      avinrique/earthlingaidtech.  Nothing else — a token that can only touch this one repo
 *      cannot be used to reach the rest of the account if it ever leaks.
 *   3. Repository permissions: set **Contents: Read and write**. That is the minimum GitHub
 *      accepts for the `POST /repos/{owner}/{repo}/dispatches` endpoint; there is no narrower
 *      "dispatch only" permission. Leave every other permission on "No access".
 *   4. Expiry: pick a date you will actually notice. When it lapses this endpoint starts
 *      returning the "token expired" message below rather than failing silently.
 *   5. Copy the token, then from backend/:
 *
 *        vercel env add GITHUB_TOKEN production
 *
 *      Paste it at the prompt, then redeploy (`npm run deploy`) so the function picks it up.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * DEGRADING WITHOUT THE TOKEN
 * If GITHUB_TOKEN is absent we return 200 with triggered:false and a plain-English message, not an
 * error. Nothing is actually broken in that state: the edits are safely in the database and the
 * next deploy — a push, or a manual "Run workflow" — will pick them up. Treating optional setup as
 * a failure would make the console look broken to an operator whose data is perfectly fine.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth } from '../lib/auth.js';
import { applyCors, json, methodNotAllowed } from '../lib/http.js';
import { GLOBAL, hitLimit } from '../lib/ratelimit.js';

/** The repository whose Pages workflow serves earthlingaidtech.com. */
const REPO = 'avinrique/earthlingaidtech';

/** Must match `on.repository_dispatch.types` in .github/workflows/deploy.yml. */
const EVENT_TYPE = 'publish-content';

/**
 * Below the function's 15s maxDuration (see vercel.json). GitHub's dispatch endpoint normally
 * answers in well under a second; if it is hanging we would rather report that ourselves than let
 * the platform kill the invocation and hand the console an opaque 504.
 */
const GITHUB_TIMEOUT_MS = 8000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS']);
  if (requireAuth(req, res)) return;

  // Keyed globally, not per client: the resource being protected is the shared build queue, so a
  // second browser tab must not get its own allowance. See the `publish` rule in lib/ratelimit.ts.
  if (await hitLimit('publish', GLOBAL)) {
    return json(res, 429, {
      ok: false,
      error: 'rate_limited',
      message:
        'Too many publishes in a row. A site rebuild takes a few minutes — your changes are ' +
        'saved, so wait for the current build to finish before publishing again.',
    });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return json(res, 200, {
      ok: true,
      triggered: false,
      reason: 'no_token',
      message:
        'Your changes are saved. Automatic publishing is not set up yet (no GitHub token), so ' +
        'they will appear on the website the next time it is deployed.',
    });
  }

  let response: Response;
  try {
    response = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        // GitHub rejects API calls without a User-Agent.
        'User-Agent': 'earthlingaidtech-admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_type: EVENT_TYPE }),
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    });
  } catch {
    // Network error or timeout. The exception text can carry the request details, so it is never
    // surfaced or logged here — nothing about this failure is worth risking the token over.
    return json(res, 502, {
      ok: false,
      error: 'github_unreachable',
      message:
        'Could not reach GitHub to start the rebuild. Your changes are saved — try publishing ' +
        'again in a minute.',
    });
  }

  // A successful dispatch is 204 No Content. Anything else is worth translating.
  if (response.status === 204) {
    return json(res, 200, {
      ok: true,
      triggered: true,
      message:
        'Publishing. The website rebuilds automatically and your changes should be live in a ' +
        'few minutes.',
    });
  }

  return json(res, 502, {
    ok: false,
    error: 'github_failed',
    status: response.status,
    // Deliberately our own wording rather than GitHub's response body: the body is untrusted text
    // that the console would have to render, and it tells the operator nothing actionable.
    message: describeGitHubFailure(response.status),
  });
}

/**
 * Turn a GitHub status into something an operator can act on.
 *
 * The distinction that matters is "your token is wrong" (fixable in five minutes, see the setup
 * block above) versus "the configuration in this file is wrong" (a code change). 404 falls in the
 * second group and is easy to misread: GitHub returns 404 rather than 403 for a repository the
 * token cannot see, precisely so that a token cannot be used to probe for private repos.
 */
function describeGitHubFailure(status: number): string {
  if (status === 401 || status === 403) {
    return (
      'GitHub rejected the publish token — it has probably expired, or it is missing the ' +
      '"Contents: Read and write" permission. Your changes are saved; regenerate the token to ' +
      'publish automatically again.'
    );
  }
  if (status === 404) {
    return (
      'GitHub could not find the website repository, or the token has no access to it. Your ' +
      'changes are saved, but publishing needs to be reconfigured.'
    );
  }
  return (
    `GitHub refused the rebuild request (HTTP ${status}). Your changes are saved — try again ` +
    'shortly.'
  );
}
