import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Store } from "lucide-react";
import { getUser } from "@/lib/supabase/server";

export default async function AdminPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/admin");

  const { data } = await supabase.from("venue_admins").select("venues(id, name, slug)");
  const venues = (data ?? []).flatMap((r) => (r.venues ? [r.venues as unknown as { id: string; name: string; slug: string }] : []));

  return (
    <div className="space-y-5 pt-4">
      <header>
        <p className="eyebrow">Venue admin</p>
        <h1 className="mt-1 text-3xl font-semibold">Your venues</h1>
      </header>
      {venues.length === 0 ? (
        <div className="card rise text-sm text-muted">
          You&apos;re not an admin of any venue yet. Ask the Venue Connect team to add you.
        </div>
      ) : (
        <ul className="card rise divide-hair p-2">
          {venues.map((v) => (
            <li key={v.id}>
              <Link href={`/admin/${v.id}`} className="row flex items-center gap-3 p-3">
                <span className="avatar h-10 w-10">
                  <Store size={18} />
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{v.name}</p>
                  <p className="text-sm text-muted">/v/{v.slug}</p>
                </div>
                <ChevronRight size={18} className="text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
