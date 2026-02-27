import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";
import { verifySessionToken } from '@/lib/utils/auth';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (token) {
    try {
      await verifySessionToken(token);
      redirect("/dashboard");
    } catch {
      // Token exists but is invalid — proceed to show landing
    }
  }

  return <LandingPage />;
}
