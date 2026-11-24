import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import type { MatchRow } from "@/lib/types";
import Chat from "./Chat";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=/chat/${id}`);

  const { data } = await supabase.rpc("my_matches");
  const match = ((data as MatchRow[]) ?? []).find((m) => m.id === id);
  if (!match) notFound();

  const { data: me } = await supabase.from("profiles").select("public_key").eq("id", user.id).maybeSingle();

  return <Chat match={match} userId={user.id} myServerKey={me?.public_key ?? null} />;
}
