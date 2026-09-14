import { redirect } from "next/navigation";

export default function Page() {
  redirect("/auth/v1/login");
}
