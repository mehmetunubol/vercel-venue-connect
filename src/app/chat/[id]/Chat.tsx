"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { decryptJson, deriveChatKey, encryptJson } from "@/lib/crypto";
import { syncKeys } from "@/lib/keys";
import { timeLeft } from "@/lib/constants";
import type { MatchRow } from "@/lib/types";
import ReportBlock from "@/components/ReportBlock";
import { ChevronLeft, Handshake, LockKeyhole, SendHorizontal } from "lucide-react";

type Payload = { t?: string; c?: { instagram?: string; whatsapp?: string } };
type Row = { id: number; sender_id: string; ciphertext: string; iv: string; is_contact: boolean; created_at: string };
type Msg = Row & { payload: Payload | null };

export default function Chat({
  match,
  userId,
  myServerKey,
}: {
  match: MatchRow;
  userId: string;
  myServerKey: JsonWebKey | null;
}) {
  const router = useRouter();
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [instagram, setInstagram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const closed = new Date(match.expires_at).getTime() <= Date.now();
  const used = messages.filter((m) => !m.is_contact).length;
  const left = Math.max(0, match.message_cap - used);
  const iShared = messages.some((m) => m.is_contact && m.sender_id === userId);

  // Set up encryption key, load history, subscribe to new messages
  useEffect(() => {
    if (!match.other_public_key) return;
    const supabase = createClient();
    let cancelled = false;
    let chatKey: CryptoKey;

    const addRows = async (rows: Row[]) => {
      const decrypted = await Promise.all(
        rows.map(async (r) => ({ ...r, payload: await decryptJson<Payload>(chatKey, r.ciphertext, r.iv) })),
      );
      if (cancelled) return;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...decrypted.filter((m) => !seen.has(m.id))].sort((a, b) => a.id - b.id);
      });
    };

    const channel = supabase.channel(`chat:${match.id}`);

    (async () => {
      const keys = await syncKeys(supabase, userId, myServerKey);
      chatKey = await deriveChatKey(keys.privateKey, match.other_public_key!, match.id);
      if (cancelled) return;
      setKey(chatKey);

      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${match.id}` },
          (p) => addRows([p.new as Row]),
        )
        .subscribe();

      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, ciphertext, iv, is_contact, created_at")
        .eq("match_id", match.id)
        .order("id");
      await addRows((data as Row[]) ?? []);
    })().catch((e) => setError(e instanceof Error ? e.message : "Could not set up encryption"));

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [match.id, match.other_public_key, userId, myServerKey]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(payload: Payload, isContact: boolean) {
    if (!key) return;
    setBusy(true);
    setError(null);
    const { ciphertext, iv } = await encryptJson(key, payload);
    const { data, error } = await createClient()
      .from("messages")
      .insert({ match_id: match.id, ciphertext, iv, is_contact: isContact })
      .select("id, sender_id, ciphertext, iv, is_contact, created_at")
      .single();
    setBusy(false);
    if (error) return setError(error.message);
    const row = data as Row;
    setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, payload }]));
    return true;
  }

  async function sendText(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (await send({ t: t.slice(0, 500) }, false)) setText("");
  }

  async function shareContact(e: React.FormEvent) {
    e.preventDefault();
    const ig = instagram.trim().replace(/^@/, "");
    const wa = whatsapp.trim();
    if (!ig && !wa) return setError("Add at least one contact.");
    if (await send({ c: { instagram: ig || undefined, whatsapp: wa || undefined } }, true)) setShowShare(false);
  }

  return (
    <div className="-mb-32 flex h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] flex-col">
      <div className="glass-strong flex items-center gap-3 rounded-full p-1.5 pr-2">
        <Link href="/matches" aria-label="Back" className="avatar h-9 w-9"><ChevronLeft size={18} /></Link>
        {match.other_photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={match.other_photo} alt="" className="h-9 w-9 rounded-full object-cover" />
        )}
        <div className="flex-1">
          <p className="font-semibold">{match.other_name}</p>
          <p className="flex items-center gap-1 text-xs text-muted">
            <LockKeyhole size={11} /> End-to-end encrypted · {closed ? "closed" : `closes in ${timeLeft(match.expires_at)}`}
          </p>
        </div>
        <ReportBlock userId={match.other_id} venueId={match.venue_id} onDone={() => router.push("/matches")} />
      </div>

      <div className="scroll-thin flex-1 space-y-2 overflow-y-auto py-4">
        <p className="pb-2 text-center text-xs text-muted">
          You matched at {match.venue_name}. You have {match.message_cap} messages between you to decide whether to
          swap contacts.
        </p>
        {!match.other_public_key && (
          <p className="text-center text-sm text-muted">Waiting for {match.other_name} to set up secure chat…</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`rise max-w-[80%] rounded-[1.25rem] px-4 py-2 ${
                  mine ? "bg-mine text-mine-ink" : "glass"
                }`}
              >
                {!m.payload ? (
                  <span className="inline-flex items-center gap-1.5 italic opacity-70"><LockKeyhole size={13} /> Can&apos;t decrypt on this device</span>
                ) : m.payload.c ? (
                  <ContactCard contact={m.payload.c} mine={mine} />
                ) : (
                  <span className="whitespace-pre-wrap break-words">{m.payload.t}</span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {error && <p className="pb-2 text-sm text-danger">{error}</p>}

      {closed ? (
        <p className="card safe-bottom mb-3 text-center text-sm text-muted">This chat is closed.</p>
      ) : showShare ? (
        <form onSubmit={shareContact} className="card glass-strong mb-3 space-y-3">
          <p className="text-sm font-semibold">Share your contact with {match.other_name}</p>
          <input className="field" placeholder="Instagram username" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
          <input className="field" placeholder="WhatsApp number (+90…)" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          <div className="flex gap-3">
            <button type="button" className="btn btn-quiet flex-1" onClick={() => setShowShare(false)}>Cancel</button>
            <button className="btn btn-primary flex-1" disabled={busy || !key}>Share</button>
          </div>
        </form>
      ) : (
        <div className="safe-bottom space-y-2">
          {!iShared && (
            <button className="btn btn-quiet w-full" onClick={() => setShowShare(true)} disabled={!key}>
              <Handshake size={17} /> Share my Instagram / WhatsApp
            </button>
          )}
          {left > 0 ? (
            <form onSubmit={sendText} className="glass-strong flex gap-2 rounded-full p-1.5">
              <input
                className="min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-faint"
                maxLength={500}
                placeholder={key ? `Message (${left} left)` : "Setting up encryption…"}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!key}
              />
              <button aria-label="Send" className="btn btn-primary h-10 w-10 p-0" disabled={busy || !key || !text.trim()}><SendHorizontal size={17} /></button>
            </form>
          ) : (
            <p className="text-center text-sm text-muted">Message limit reached. Share your contact to keep talking.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ContactCard({ contact, mine }: { contact: NonNullable<Payload["c"]>; mine: boolean }) {
  const wa = contact.whatsapp?.replace(/[^\d]/g, "");
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold">{mine ? "You shared your contact" : "Shared their contact"}</p>
      {contact.instagram && (
        <a className="block underline" href={`https://instagram.com/${encodeURIComponent(contact.instagram)}`} target="_blank" rel="noreferrer">
          Instagram: @{contact.instagram}
        </a>
      )}
      {wa && (
        <a className="block underline" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
          WhatsApp: {contact.whatsapp}
        </a>
      )}
    </div>
  );
}
