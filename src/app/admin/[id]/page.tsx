import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { getUser } from "@/lib/supabase/server";
import VenueSettings from "./VenueSettings";

type Stats = {
  profiles_published: number;
  unique_people: number;
  matches: number;
  contacts_exchanged: number;
  active_now: number;
};

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export default async function VenueAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getUser();
  if (!user) redirect(`/login?next=/admin/${id}`);

  const { data: venue } = await supabase.from("venues").select("*").eq("id", id).maybeSingle();
  if (!venue) notFound();

  const { data: statsRows, error } = await supabase.rpc("venue_stats", { p_venue: id, p_days: 30 });
  if (error) notFound(); // not an admin of this venue
  const stats = (statsRows as Stats[])[0];

  const url = `${await siteUrl()}/v/${venue.slug}`;
  const qr = await QRCode.toDataURL(url, { width: 800, margin: 2 });

  const tiles = [
    { label: "Active now", value: stats.active_now },
    { label: "Profiles published", value: stats.profiles_published },
    { label: "Unique people", value: stats.unique_people },
    { label: "Matches", value: stats.matches },
    { label: "Contacts exchanged", value: stats.contacts_exchanged },
  ];

  return (
    <div className="space-y-5 pt-4">
      <header>
        <p className="eyebrow">Venue admin</p>
        <h1 className="mt-1 text-3xl font-semibold">{venue.name}</h1>
      </header>

      <section className="card rise space-y-3">
        <p className="eyebrow">Last 30 days</p>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="glass rounded-2xl p-3">
              <p className="text-2xl font-semibold tabular-nums">{t.value}</p>
              <p className="text-xs text-muted">{t.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card rise space-y-3 text-center">
        <p className="eyebrow">Venue QR code</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`QR code for ${url}`} className="mx-auto w-56 rounded-2xl bg-white p-2" />
        <p className="break-all text-xs text-muted">{url}</p>
        <a href={qr} download={`${venue.slug}-qr.png`} className="btn btn-quiet">
          Download QR
        </a>
      </section>

      <VenueSettings venue={venue} />
    </div>
  );
}
