import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import PublishButton from "./PublishButton";
import { LockKeyhole } from "lucide-react";

export default async function VenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user } = await getUser();
  const { data: venue } = await supabase.from("venues").select("*").eq("slug", slug).maybeSingle();
  if (!venue) notFound();

  const here = `/v/${slug}`;

  if (user) {
    const { data: post } = await supabase
      .from("venue_posts")
      .select("id")
      .eq("venue_id", venue.id)
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (post) redirect(`${here}/browse`);
  }

  const profile = user
    ? (await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle()).data
    : null;

  return (
    <div className="card glass-strong rise mt-8 space-y-6 p-6 text-center">
      {venue.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={venue.logo_url} alt="" className="mx-auto h-20 w-20 rounded-2xl object-cover" />
      )}
      <div>
        <p className="eyebrow">You&apos;re at</p>
        <h1 className="mt-1 text-4xl font-semibold">{venue.name}</h1>
      </div>
      <p className="text-muted">
        Publish your profile here and meet people who&apos;ve been at {venue.name}. It stays visible for{" "}
        <strong className="text-ink">{venue.visibility_hours} hours</strong>, then disappears.
      </p>

      {!user ? (
        <Link href={`/login?next=${encodeURIComponent(here)}`} className="btn btn-primary w-full">
          Get started
        </Link>
      ) : !profile ? (
        <Link href={`/profile?next=${encodeURIComponent(here)}`} className="btn btn-primary w-full">
          Create your profile
        </Link>
      ) : (
        <PublishButton venueId={venue.id} slug={slug} hours={venue.visibility_hours} />
      )}

      <p className="flex items-start justify-center gap-1.5 text-xs text-muted">
        <LockKeyhole size={13} className="mt-px shrink-0" /> Chats are end-to-end encrypted and limited to {venue.message_cap} messages. Your exact location is never shared.
      </p>
    </div>
  );
}
