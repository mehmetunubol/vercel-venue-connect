"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Venue = {
  id: string;
  name: string;
  logo_url: string | null;
  visibility_hours: number;
  message_cap: number;
  chat_hours: number;
};

export default function VenueSettings({ venue }: { venue: Venue }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: venue.name,
    logo_url: venue.logo_url ?? "",
    visibility_hours: venue.visibility_hours,
    message_cap: venue.message_cap,
    chat_hours: venue.chat_hours,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const { error } = await createClient()
      .from("venues")
      .update({ ...form, logo_url: form.logo_url.trim() || null })
      .eq("id", venue.id);
    setBusy(false);
    setStatus(error ? error.message : "Saved");
    if (!error) router.refresh();
  }

  const num = (key: "visibility_hours" | "message_cap" | "chat_hours", label: string, min: number, max: number, hint: string) => (
    <div>
      <label className="label" htmlFor={key}>{label}</label>
      <input
        id={key}
        type="number"
        className="field tabular-nums"
        min={min}
        max={max}
        required
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
      />
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );

  return (
    <form onSubmit={save} className="card rise space-y-4">
      <p className="eyebrow">Settings</p>
      <div>
        <label className="label" htmlFor="name">Venue name</label>
        <input id="name" className="field" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor="logo">Logo URL</label>
        <input id="logo" className="field" type="url" placeholder="https://…" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
      </div>
      {num("visibility_hours", "Profile visible for (hours)", 1, 168, "How long a published profile stays visible.")}
      {num("message_cap", "Messages per chat", 2, 50, "Total messages a matched pair can send before swapping contacts.")}
      {num("chat_hours", "Chat open for (hours)", 1, 168, "After this, the chat closes and its messages are deleted.")}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
      {status && <p className="text-center text-sm text-muted">{status}</p>}
    </form>
  );
}
