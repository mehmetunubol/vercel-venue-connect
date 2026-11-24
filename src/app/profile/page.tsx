import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/profile${next ? `?next=${encodeURIComponent(next)}` : ""}`)}`);

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  return (
    <div className="space-y-5 pt-4">
      <header>
        <p className="eyebrow">{profile ? "Profile" : "Step 1 of 2"}</p>
        <h1 className="mt-1 text-3xl font-semibold">{profile ? "Your profile" : "Create your profile"}</h1>
      </header>
      <ProfileForm userId={user.id} email={user.email ?? ""} profile={profile} next={next} />
    </div>
  );
}
