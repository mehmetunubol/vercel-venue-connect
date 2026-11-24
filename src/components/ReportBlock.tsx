"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Ellipsis } from "lucide-react";

export default function ReportBlock({
  userId,
  venueId,
  onDone,
}: {
  userId: string;
  venueId?: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);

  async function block() {
    if (!confirm("Block this person? They won't see you and any chat will close.")) return;
    await createClient().rpc("block_user", { p_target: userId });
    setOpen(false);
    onDone?.();
  }

  async function report() {
    const reason = prompt("What happened? (This is sent to the team, not the person.)");
    if (!reason?.trim()) return;
    const supabase = createClient();
    await supabase.from("reports").insert({ reported_id: userId, venue_id: venueId ?? null, reason: reason.trim().slice(0, 500) });
    await supabase.rpc("block_user", { p_target: userId });
    alert("Thanks. We've received your report and blocked this person for you.");
    setOpen(false);
    onDone?.();
  }

  return (
    <div className="relative">
      <button aria-label="More options" className="avatar h-9 w-9 text-muted" onClick={() => setOpen((o) => !o)}>
        <Ellipsis size={20} />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-36 overflow-hidden glass-strong divide-hair rounded-2xl text-sm">
          <button className="block w-full px-4 py-3 text-left row rounded-none" onClick={block}>Block</button>
          <button className="block w-full px-4 py-3 text-left text-danger row rounded-none" onClick={report}>Report</button>
        </div>
      )}
    </div>
  );
}
