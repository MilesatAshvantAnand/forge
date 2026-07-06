"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Users, Mail, Loader2, CheckCircle, XCircle, Crown } from "lucide-react";

interface Member {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  user?: { name: string; email: string };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
}

interface TeamData {
  id: string;
  name: string;
  slug: string | null;
  members: Member[];
  invitations: Invitation[];
}

export default function TeamSettingsPage() {
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/team")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load team");
        return r.json();
      })
      .then((data) => {
        setTeam(data.team);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);

    try {
      const res = await fetch("/api/settings/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invite failed");
      setInviteSuccess(true);
      setInviteEmail("");
      // Reload team data to show new invitation
      const updated = await fetch("/api/settings/team").then((r) => r.json());
      setTeam(updated.team);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-14">
      <div className="mb-8 flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80">
          <Flame className="h-5 w-5 text-[var(--accent)]" />
          <span className="text-sm font-semibold tracking-tight">Forge</span>
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <span className="text-sm text-[var(--muted)]">Team Settings</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : team ? (
        <div className="space-y-10">
          <section>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[var(--accent)]" />
              <h1 className="text-xl font-semibold">{team.name}</h1>
            </div>
            {team.slug && (
              <p className="mt-1 text-xs text-[var(--muted)]">Slug: {team.slug}</p>
            )}
          </section>

          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
              Members
            </h2>
            <div className="space-y-2">
              {team.members.map((m) => (
                <div
                  key={m.id}
                  className="glass flex items-center justify-between rounded-xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {m.user?.name ?? m.userId}
                    </p>
                    {m.user?.email && (
                      <p className="text-xs text-[var(--muted)]">{m.user.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {m.role === "owner" && (
                      <Crown className="h-3.5 w-3.5 text-[var(--accent)]" />
                    )}
                    <span className="rounded-full bg-[var(--elevated)] px-2.5 py-1 text-xs capitalize text-[var(--muted)]">
                      {m.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
              Invite a teammate
            </h2>
            <form onSubmit={handleInvite} className="flex gap-2">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@email.com"
                className="glass min-w-0 flex-1 rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/60"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="glass rounded-xl px-3 py-3 text-sm outline-none"
              >
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="submit"
                disabled={inviting}
                className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-black hover:opacity-90 disabled:opacity-60"
              >
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Invite
              </button>
            </form>

            {inviteSuccess && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-green-400">
                <CheckCircle className="h-3.5 w-3.5" />
                Invitation sent!
              </p>
            )}
            {inviteError && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
                <XCircle className="h-3.5 w-3.5" />
                {inviteError}
              </p>
            )}
          </section>

          {team.invitations.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
                Pending invitations
              </h2>
              <div className="space-y-2">
                {team.invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="glass flex items-center justify-between rounded-xl px-4 py-3"
                  >
                    <p className="text-sm">{inv.email}</p>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[var(--elevated)] px-2.5 py-1 text-xs capitalize text-[var(--muted)]">
                        {inv.role ?? "member"}
                      </span>
                      <span className="rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs text-yellow-400">
                        pending
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : null}
    </main>
  );
}
