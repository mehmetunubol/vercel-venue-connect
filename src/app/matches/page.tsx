import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { timeLeft } from "@/lib/constants";
import type { MatchRow } from "@/lib/types";
import { Handshake } from "lucide-react";

export default async function MatchesPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/matches");

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/profile?next=/matches");

  const { data } = await supabase.rpc("my_matches");
  const matches = (data as MatchRow[]) ?? [];
  const now = Date.now();
  const open = matches.filter((m) => new Date(m.expires_at).getTime() > now);
  const closed = matches.filter((m) => new Date(m.expires_at).getTime() <= now);

  return (
    <div className="space-y-5 pt-4">
      <header>
        <p className="eyebrow">{open.length} open</p>
        <h1 className="mt-1 text-3xl font-semibold">Matches</h1>
      </header>
      {open.length === 0 && (
        <div className="card rise text-center text-muted">
          No open chats yet. Publish your profile at a venue and start liking people.
        </div>
      )}
      <ul className={open.length ? "card divide-hair p-2" : "hidden"}>
        {open.map((m) => (
          <li key={m.id}>
            <Link href={`/chat/${m.id}`} className="row flex items-center gap-4 p-3">
              <Avatar url={m.other_photo} />
              <div className="flex-1">
                <p className="font-semibold">{m.other_name}</p>
                <p className="text-sm text-muted tabular-nums">
                  {m.venue_name} · {m.message_cap - m.messages_used} messages left · closes in {timeLeft(m.expires_at)}
                </p>
              </div>
              {m.they_shared && <Handshake size={18} className="text-accent" aria-label="They shared their contact" />}
            </Link>
          </li>
        ))}
      </ul>
      {closed.length > 0 && (
        <details className="px-2 text-sm text-muted">
          <summary className="cursor-pointer">Closed chats ({closed.length})</summary>
          <ul className="mt-3 space-y-2">
            {closed.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar url={m.other_photo} small />
                {m.other_name} · {m.venue_name}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Avatar({ url, small }: { url: string | null; small?: boolean }) {
  const size = small ? "h-8 w-8" : "h-14 w-14";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`${size} rounded-full object-cover`} />
  ) : (
    <div className={`avatar ${size}`} />
  );
}
