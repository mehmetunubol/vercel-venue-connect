"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { intentLabel, timeLeft } from "@/lib/constants";
import ReportBlock from "@/components/ReportBlock";
import { Heart, RefreshCw, Sparkles, X } from "lucide-react";

type Person = {
  id: string;
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  intents: string[];
  interests: string[];
  shared_interests: number;
  visible_until: string;
};

export default function Feed({
  venue,
  slug,
  myExpiry,
  initialPeople,
}: {
  venue: { id: string; name: string };
  slug: string;
  myExpiry: string;
  initialPeople: Person[];
}) {
  const router = useRouter();
  const [people, setPeople] = useState(initialPeople);
  const [busy, setBusy] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const person = people[0];

  async function swipe(liked: boolean) {
    if (!person) return;
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc("swipe", { p_venue: venue.id, p_to: person.id, p_liked: liked });
    setBusy(false);
    if (error) setError(error.message);
    if (data) setMatchId(data as string);
    setPeople((p) => p.slice(1));
  }

  async function refresh() {
    const { data } = await createClient().rpc("venue_feed", { p_venue: venue.id });
    setPeople((data as Person[]) ?? []);
  }

  async function hideMe() {
    if (!confirm("Hide your profile at this venue now?")) return;
    await createClient().rpc("unpublish_at_venue", { p_venue: venue.id });
    router.push(`/v/${slug}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between pt-4 text-sm">
        <div>
          <p className="eyebrow">Visible for {timeLeft(myExpiry)}</p>
          <h1 className="mt-1 text-2xl font-semibold">{venue.name}</h1>
        </div>
        <button onClick={hideMe} className="btn btn-quiet btn-sm">Hide me</button>
      </div>

      {matchId && (
        <div className="card glass-strong rise space-y-4 text-center">
          <span className="avatar mx-auto h-14 w-14 text-accent"><Heart size={24} fill="currentColor" /></span>
          <p className="text-2xl font-semibold">It&apos;s a match</p>
          <div className="flex justify-center gap-3">
            <Link href={`/chat/${matchId}`} className="btn btn-primary">Say hi</Link>
            <button className="btn btn-quiet" onClick={() => setMatchId(null)}>Keep browsing</button>
          </div>
        </div>
      )}

      {person ? (
        <div key={person.id} className="card rise overflow-hidden p-0">
          {person.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.photo_url} alt="" className="aspect-[4/5] w-full object-cover" />
          )}
          <div className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-2xl font-semibold">{person.display_name}</h2>
              <ReportBlock userId={person.id} venueId={venue.id} onDone={() => setPeople((p) => p.slice(1))} />
            </div>
            {person.bio && <p>{person.bio}</p>}
            <div className="flex flex-wrap gap-2">
              {person.intents.map((i) => (
                <span key={i} className="chip" aria-pressed="true">{intentLabel(i)}</span>
              ))}
            </div>
            {person.interests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {person.interests.map((i) => (
                  <span key={i} className="chip">{i}</span>
                ))}
              </div>
            )}
            {person.shared_interests > 0 && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-accent"><Sparkles size={15} /> {person.shared_interests} shared interest{person.shared_interests > 1 ? "s" : ""}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 p-5 pt-0">
            <button className="btn btn-quiet" disabled={busy} onClick={() => swipe(false)}><X size={18} /> Pass</button>
            <button className="btn btn-like" disabled={busy} onClick={() => swipe(true)}><Heart size={18} fill="currentColor" /> Like</button>
          </div>
        </div>
      ) : (
        <div className="card rise space-y-3 text-center">
          <p className="text-lg font-semibold">No one new right now</p>
          <p className="text-sm text-muted">
            New people appear as they publish their profiles at {venue.name}. Check back later.
          </p>
          <div className="flex justify-center gap-3">
            <button className="btn btn-quiet" onClick={refresh}><RefreshCw size={16} /> Refresh</button>
            <Link href="/matches" className="btn btn-primary">My matches</Link>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
