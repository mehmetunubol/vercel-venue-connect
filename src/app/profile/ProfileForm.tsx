"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { INTENTS, INTERESTS, MAX_INTERESTS } from "@/lib/constants";
import { syncKeys } from "@/lib/keys";
import { Camera } from "lucide-react";

type Profile = {
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  intents: string[];
  interests: string[];
  public_key: JsonWebKey | null;
};

/** Shrink a photo to max 800px JPEG in the browser before uploading. */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/jpeg", 0.85),
  );
}

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export default function ProfileForm({
  userId,
  email,
  profile,
  next,
}: {
  userId: string;
  email: string;
  profile: Profile | null;
  next?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [intents, setIntents] = useState<string[]>(profile?.intents ?? []);
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const photoUrl = profile?.photo_url ?? null;
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [adult, setAdult] = useState(!!profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, id: string, max?: number) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : max && list.length >= max ? list : [...list, id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (intents.length === 0) return setError("Pick at least one thing you're up for.");
    if (!photoUrl && !photoFile) return setError("Add a photo so people can recognise you.");
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      let url = photoUrl;
      if (photoFile) {
        const blob = await resizeImage(photoFile);
        const path = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        url = supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
      }
      const row = {
        id: userId,
        display_name: name.trim(),
        bio: bio.trim() || null,
        photo_url: url,
        intents,
        interests,
        is_adult: adult,
      };
      const { error: dbErr } = await supabase.from("profiles").upsert(row);
      if (dbErr) throw dbErr;
      await syncKeys(supabase, userId, profile?.public_key);
      router.push(safeNext(next) ?? "/matches");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!confirm("Delete your profile, matches and chats permanently?")) return;
    const supabase = createClient();
    const { data: files } = await supabase.storage.from("photos").list(userId);
    if (files?.length) await supabase.storage.from("photos").remove(files.map((f) => `${userId}/${f.name}`));
    const { error } = await supabase.rpc("delete_me");
    if (error) return setError(error.message);
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const preview = photoFile ? URL.createObjectURL(photoFile) : photoUrl;

  return (
    <form onSubmit={save} className="card rise space-y-6">
      <div className="flex items-center gap-4">
        <label className="relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden avatar text-muted">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <Camera size={26} />
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && setPhotoFile(e.target.files[0])}
          />
        </label>
        <div className="flex-1">
          <label className="label" htmlFor="name">Name</label>
          <input id="name" className="field" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="bio">About you <span className="font-normal normal-case tracking-normal">(optional)</span></label>
        <textarea
          id="bio"
          className="field min-h-20"
          maxLength={200}
          placeholder="One or two lines…"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      <div>
        <span className="label">I&apos;m up for</span>
        <div className="flex flex-wrap gap-2">
          {INTENTS.map((i) => (
            <button
              type="button"
              key={i.id}
              className="chip"
              aria-pressed={intents.includes(i.id)}
              onClick={() => toggle(intents, setIntents, i.id)}
            >
              {i.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">You only see people who are up for at least one of the same things.</p>
      </div>

      <div>
        <span className="label">
          Interests <span className="tabular-nums">· {interests.length}/{MAX_INTERESTS}</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <button
              type="button"
              key={i}
              className="chip"
              aria-pressed={interests.includes(i)}
              onClick={() => toggle(interests, setInterests, i, MAX_INTERESTS)}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" required checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-1" />
        <span>I am 18 or older and agree to be respectful. I understand my profile is visible to people at venues where I publish it.</span>
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Saving…" : "Save profile"}
      </button>

      {profile && (
        <div className="space-y-3 border-t border-hairline pt-6 text-sm">
          <p className="text-muted">Signed in as {email}</p>
          <div className="flex gap-3">
            <button type="button" className="btn btn-quiet" onClick={signOut}>Sign out</button>
            <button type="button" className="btn btn-danger" onClick={deleteAccount}>Delete account</button>
          </div>
        </div>
      )}
    </form>
  );
}
