import { redirect } from "next/navigation";
import { AuthForm } from "@/app/auth-form";
import { getCurrentUser } from "@/lib/dal";

export default async function Page() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <AuthForm mode="login" />;
}
