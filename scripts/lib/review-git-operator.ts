import { execFileSync } from "node:child_process";

import { gitOperatorActor, gitOperatorSchema } from "../../src/lib/error-reviews/operator";

export function readGitOperator(repo = process.cwd()) {
  const read = (key: string) =>
    execFileSync("git", ["-C", repo, "config", "--get", key], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  let input;
  try {
    input = { name: read("user.name"), email: read("user.email") };
  } catch {
    throw new Error("请先为执行仓库配置 git user.name 和 user.email；未发送请求");
  }
  const identity = gitOperatorSchema.parse(input);
  return {
    actor: gitOperatorActor(identity),
    headers: { "X-Review-Git-Operator": encodeURIComponent(JSON.stringify(identity)) },
  };
}
export function gitOperatorFromArgs() {
  const i = process.argv.indexOf("--repo");
  if (i >= 0 && (!process.argv[i + 1] || process.argv[i + 1].startsWith("--")))
    throw new Error("--repo requires a repository path");
  return readGitOperator(i >= 0 ? process.argv[i + 1] : undefined);
}
