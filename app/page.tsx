import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LAST_TAB_COOKIE } from "@/lib/constants";
import { isValidScope } from "@/lib/cookies";

export default async function RootPage() {
  const c = await cookies();
  const last = c.get(LAST_TAB_COOKIE)?.value;
  const target = isValidScope(last) ? last : "internal";
  redirect(`/${target}`);
}
