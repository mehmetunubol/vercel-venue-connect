import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import Feed from "./Feed";

export default async function BrowsePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/v/${slug}`)}`);

  const { data: venue } = await supabase.from("venues").select("id, name").eq("slug", slug).maybeSingle();
  if (!venue) notFound();

  const { data: post } = await supabase
    .from("venue_posts")
    .select("expires_at")
    .eq("venue_id", venue.id)
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!post) redirect(`/v/${slug}`);

  const { data: people } = await supabase.rpc("venue_feed", { p_venue: venue.id });

  return <Feed venue={venue} slug={slug} myExpiry={post.expires_at} initialPeople={people ?? []} />;
}
