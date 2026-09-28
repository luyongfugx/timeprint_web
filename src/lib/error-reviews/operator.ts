import { z } from "zod";

export const gitOperatorSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine((value) => [...value].every((char) => char.charCodeAt(0) >= 32 && char !== "<" && char !== ">")),
    email: z.string().trim().email().max(90),
  })
  .strict()
  .refine((v) => `git:${v.name} <${v.email}>`.length <= 100, "Git 操作者名称和邮箱合计过长（上限 100 字符）");
export function gitOperatorActor(input: unknown) {
  const v = gitOperatorSchema.parse(input);
  return `git:${v.name} <${v.email}>`;
}
export function decodeGitOperator(header: string | null) {
  if (!header || header.length > 2000) throw new Error("Missing or oversized Git operator");
  return gitOperatorActor(JSON.parse(decodeURIComponent(header)));
}
