/**
 * Reads JSON data files from the GitLab dashboards-data repository.
 *
 * At BUILD TIME: `scripts/fetch-data.mjs` clones the repo before `next build`
 * runs, so all build workers find files already present in LOCAL_DIR.
 *
 * AT RUNTIME: on first request after container start, clones the repo.
 * Data stays fresh for CACHE_TTL_MS, then re-clones on next request.
 */
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import fs from "fs";
import path from "path";
import os from "os";

const REPO_URL = "https://git.xaid.ai/telerad/dashboards-data.git";
const LOCAL_DIR = path.join(os.tmpdir(), "dashboards-data");
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let lastClone = 0;
let cloneInProgress: Promise<void> | null = null;

function getToken(): string {
  const t = process.env.GITLAB_TOKEN;
  if (!t) throw new Error("GITLAB_TOKEN env var is not set");
  return t;
}

async function doClone(): Promise<void> {
  if (fs.existsSync(LOCAL_DIR)) {
    fs.rmSync(LOCAL_DIR, { recursive: true, force: true });
  }
  await git.clone({
    fs,
    http,
    dir: LOCAL_DIR,
    url: REPO_URL,
    ref: "main",
    singleBranch: true,
    depth: 1,
    onAuth: () => ({ username: "token", password: getToken() }),
  });
  lastClone = Date.now();
}

async function ensureRepo(): Promise<void> {
  // Deduplicate concurrent calls in the same process
  if (cloneInProgress) return cloneInProgress;

  const repoExists = fs.existsSync(path.join(LOCAL_DIR, ".git"));

  // Data is fresh: repo was cloned by this process instance within TTL
  if (repoExists && lastClone > 0 && Date.now() - lastClone < CACHE_TTL_MS) {
    return;
  }

  cloneInProgress = doClone().finally(() => {
    cloneInProgress = null;
  });
  return cloneInProgress;
}

export async function readRepoJSON<T>(filename: string): Promise<T> {
  await ensureRepo();
  const filepath = path.join(LOCAL_DIR, filename);
  const raw = fs.readFileSync(filepath, "utf-8");
  return JSON.parse(raw) as T;
}
