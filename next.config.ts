import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Several lockfiles exist up the tree (this repo is also used from .claude/worktrees), which makes
  // Next guess the wrong root and watch far more than the project. Pin it to the project folder.
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
};

export default withNextIntl(nextConfig);
