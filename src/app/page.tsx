import Link from "next/link";
import { Handshake, Hourglass, LockKeyhole, QrCode, Sparkles } from "lucide-react";
import { getUser } from "@/lib/supabase/server";

const STEPS = [
  { icon: QrCode, title: "Scan at the venue", text: "Find the QR code at a partner venue." },
  { icon: Sparkles, title: "Say what you're up for", text: "A chat, new friends or a date, plus your interests." },
  { icon: Hourglass, title: "Visible for 24 hours", text: "Only to people from the same venue. Then it's gone." },
  { icon: LockKeyhole, title: "A few private messages", text: "End-to-end encrypted, limited on purpose." },
  { icon: Handshake, title: "Swap contacts", text: "Like each other? Share Instagram or WhatsApp. That's it." },
];

export default async function Home() {
  const { supabase, user } = await getUser();
  let isAdmin = false;
  if (user) {
    const { count } = await supabase.from("venue_admins").select("*", { count: "exact", head: true });
    isAdmin = (count ?? 0) > 0;
  }

  return (
    <div className="space-y-6 pt-6">
      <header className="rise">
        <p className="eyebrow">Venue Connect</p>
        <h1 className="mt-1 text-4xl font-semibold leading-tight">
          Meet people from the places <span className="text-accent">you actually go.</span>
        </h1>
      </header>

      <ol className="card rise divide-hair p-2">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3 px-3 py-3">
            <span className="avatar h-9 w-9">
              <Icon size={17} />
            </span>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>

      {user ? (
        <div className="flex flex-wrap gap-3">
          <Link href="/matches" className="btn btn-primary">My matches</Link>
          {isAdmin && <Link href="/admin" className="btn btn-quiet">Venue admin</Link>}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">To get started, scan the QR code at a participating venue.</p>
          <Link href="/login" className="btn btn-quiet">Sign in</Link>
        </div>
      )}
    </div>
  );
}
