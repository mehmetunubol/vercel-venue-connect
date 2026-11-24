"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PublishButton({ venueId, slug, hours }: { venueId: string; slug: string; hours: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("publish_at_venue", { p_venue: venueId });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push(`/v/${slug}/browse`);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button className="btn btn-primary w-full" onClick={publish} disabled={busy}>
        {busy ? "Publishing…" : `Publish my profile for ${hours}h`}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
