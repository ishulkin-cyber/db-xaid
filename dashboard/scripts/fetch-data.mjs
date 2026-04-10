/**
 * Prebuild script: clones dashboards-data repo to /tmp/dashboards-data.
 * Runs before `next build` so all build workers find data already present.
 */
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import fs from "fs";
import path from "path";
import os from "os";

const REPO_URL = "https://git.xaid.ai/telerad/dashboards-data.git";
const LOCAL_DIR = path.join(os.tmpdir(), "dashboards-data");
const TOKEN = process.env.GITLAB_TOKEN;

if (!TOKEN) {
  console.error("❌ GITLAB_TOKEN env var is not set");
  process.exit(1);
}

if (fs.existsSync(LOCAL_DIR)) {
  fs.rmSync(LOCAL_DIR, { recursive: true, force: true });
}

console.log("Fetching dashboards-data from GitLab...");
await git.clone({
  fs,
  http,
  dir: LOCAL_DIR,
  url: REPO_URL,
  ref: "main",
  singleBranch: true,
  depth: 1,
  onAuth: () => ({ username: "token", password: TOKEN }),
});
console.log("Done:", fs.readdirSync(LOCAL_DIR).filter(f => f.endsWith(".json")).join(", "));
