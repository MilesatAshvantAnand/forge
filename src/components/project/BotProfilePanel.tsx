"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Check,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import type { BotComponent, BotProfile } from "@/lib/gateway/types";

/**
 * Bot Profile setup panel — the source of truth the Bot Gateway validates
 * generated code against: firmware/kernel versions plus a full port map
 * (21 smart ports + 8 ADI ports).
 */

const SMART_PORTS = Array.from({ length: 21 }, (_, i) => i + 1);
const ADI_PORTS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const SMART_COMPONENT_TYPES: { value: string; label: string }[] = [
  { value: "", label: "— empty —" },
  { value: "motor_11w", label: "Motor (11W)" },
  { value: "motor_5_5w", label: "Motor (5.5W)" },
  { value: "rotation_sensor", label: "Rotation sensor" },
  { value: "imu", label: "IMU (Inertial)" },
  { value: "distance", label: "Distance sensor" },
  { value: "optical", label: "Optical sensor" },
  { value: "vision", label: "Vision sensor" },
  { value: "gps", label: "GPS sensor" },
  { value: "radio", label: "Radio" },
];

const ADI_COMPONENT_TYPES: { value: string; label: string }[] = [
  { value: "", label: "— empty —" },
  { value: "adi_digital_in", label: "Digital in (bumper/limit)" },
  { value: "adi_digital_out", label: "Digital out (solenoid)" },
  { value: "adi_analog_in", label: "Analog in" },
  { value: "adi_encoder", label: "Shaft encoder" },
  { value: "adi_potentiometer", label: "Potentiometer" },
  { value: "adi_line", label: "Line tracker" },
  { value: "adi_led", label: "LED" },
];

const GEARSETS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "red_100", label: "Red 100 RPM" },
  { value: "green_200", label: "Green 200 RPM" },
  { value: "blue_600", label: "Blue 600 RPM" },
];

interface KernelInfoDto {
  major: string;
  label: string;
  knownVersions: string[];
  notes: string[];
}

interface VexosInfoDto {
  version: string;
  label: string;
  notes?: string;
}

interface PortRow {
  type: string;
  label: string;
  reversed: boolean;
  gearset: string;
}

const EMPTY_ROW: PortRow = { type: "", label: "", reversed: false, gearset: "" };

function componentsToRows(components: BotComponent[]): Map<string, PortRow> {
  const map = new Map<string, PortRow>();
  for (const c of components) {
    map.set(String(c.port).toUpperCase(), {
      type: c.type,
      label: c.label ?? "",
      reversed: Boolean(c.reversed),
      gearset: c.gearset ?? "",
    });
  }
  return map;
}

function rowsToComponents(rows: Map<string, PortRow>): BotComponent[] {
  const out: BotComponent[] = [];
  for (const [portKey, row] of rows) {
    if (!row.type) continue;
    const isAdi = /^[A-H]$/.test(portKey);
    const component: BotComponent = {
      port: isAdi ? portKey : Number(portKey),
      type: row.type,
      label: row.label.trim(),
    };
    if (row.type.startsWith("motor")) {
      if (row.reversed) component.reversed = true;
      if (row.gearset) component.gearset = row.gearset;
    }
    out.push(component);
  }
  return out;
}

export function BotProfilePanel({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [readOnly, setReadOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [kernels, setKernels] = useState<KernelInfoDto[]>([]);
  const [vexosVersions, setVexosVersions] = useState<VexosInfoDto[]>([]);

  const [name, setName] = useState("My Robot");
  const [firmwareVersion, setFirmwareVersion] = useState("");
  const [prosKernelVersion, setProsKernelVersion] = useState("");
  const [rows, setRows] = useState<Map<string, PortRow>>(new Map());

  useEffect(() => {
    fetch(`/api/projects/${projectId}/bot-profile`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load bot profile");
        setReadOnly(Boolean(data.readOnly));
        setKernels(data.registry?.kernels ?? []);
        setVexosVersions(data.registry?.vexos ?? []);
        const profile = data.profile as BotProfile | null;
        if (profile) {
          setName(profile.name);
          setFirmwareVersion(profile.firmwareVersion ?? "");
          setProsKernelVersion(profile.prosKernelVersion ?? "");
          setRows(componentsToRows(profile.components));
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load bot profile")
      )
      .finally(() => setLoading(false));
  }, [projectId]);

  const updateRow = useCallback(
    (port: string, patch: Partial<PortRow>) => {
      if (readOnly) return;
      setRows((prev) => {
        const next = new Map(prev);
        const current = next.get(port) ?? { ...EMPTY_ROW };
        next.set(port, { ...current, ...patch });
        return next;
      });
      setDirty(true);
      setSaved(false);
    },
    [readOnly]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/bot-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          firmwareVersion: firmwareVersion || null,
          prosKernelVersion: prosKernelVersion || null,
          brainType: "V5",
          components: rowsToComponents(rows),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [projectId, name, firmwareVersion, prosKernelVersion, rows]);

  const activeKernel = useMemo(
    () => kernels.find((k) => prosKernelVersion.startsWith(k.major)),
    [kernels, prosKernelVersion]
  );

  const configuredCount = useMemo(
    () => [...rows.values()].filter((r) => r.type).length,
    [rows]
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-[var(--muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading bot profile…
      </div>
    );
  }

  const inputCls =
    "glass rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)] disabled:opacity-60";

  const renderPortRow = (
    portKey: string,
    types: { value: string; label: string }[]
  ) => {
    const row = rows.get(portKey) ?? EMPTY_ROW;
    const isMotor = row.type.startsWith("motor");
    return (
      <div
        key={portKey}
        className="grid grid-cols-[3rem_11rem_1fr_8rem] items-center gap-2 rounded-lg px-2 py-1 hover:bg-[var(--hover)]"
      >
        <span className="font-mono text-xs text-[var(--muted)]">{portKey}</span>
        <select
          value={row.type}
          disabled={readOnly}
          onChange={(e) => updateRow(portKey, { type: e.target.value })}
          className={inputCls}
        >
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          value={row.label}
          disabled={readOnly || !row.type}
          onChange={(e) => updateRow(portKey, { label: e.target.value })}
          placeholder={row.type ? "label, e.g. left front drive" : ""}
          className={inputCls}
        />
        {isMotor ? (
          <div className="flex items-center gap-2">
            <select
              value={row.gearset}
              disabled={readOnly}
              onChange={(e) => updateRow(portKey, { gearset: e.target.value })}
              title="Gearset cartridge"
              className={`${inputCls} w-24`}
            >
              {GEARSETS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            <label
              className="flex items-center gap-1 text-[10px] text-[var(--muted)]"
              title="Motor spins reversed"
            >
              <input
                type="checkbox"
                checked={row.reversed}
                disabled={readOnly}
                onChange={(e) => updateRow(portKey, { reversed: e.target.checked })}
              />
              <RotateCcw className="h-3 w-3" />
            </label>
          </div>
        ) : (
          <span />
        )}
      </div>
    );
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8">
      <div className="flex items-center gap-3">
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to workspace
        </Link>
      </div>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Bot className="h-5 w-5 text-[var(--accent)]" />
            Bot Profile
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Describe your exact robot — firmware, kernel, and what&apos;s plugged
            into every port. The Bot Gateway checks all generated code against
            this profile before it can be applied, so hallucinated ports or
            wrong-kernel APIs never reach the brain.
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saved ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saved && !dirty ? "Saved" : "Save profile"}
          </button>
        )}
      </div>

      {readOnly && (
        <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-[var(--accent-dim)] px-3 py-2 text-xs text-[var(--accent)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          This profile is read-only (demo / viewer access) — the gateway still
          checks code against it.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <section className="glass mt-6 rounded-xl p-4">
        <h2 className="text-sm font-semibold">Robot & firmware</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
              Robot name
            </label>
            <input
              value={name}
              disabled={readOnly}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
                setSaved(false);
              }}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
              VEXos firmware
            </label>
            <select
              value={firmwareVersion}
              disabled={readOnly}
              onChange={(e) => {
                setFirmwareVersion(e.target.value);
                setDirty(true);
                setSaved(false);
              }}
              className={inputCls}
            >
              <option value="">Not set</option>
              {vexosVersions.map((v) => (
                <option key={v.version} value={v.version}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
              PROS kernel
            </label>
            <select
              value={prosKernelVersion}
              disabled={readOnly}
              onChange={(e) => {
                setProsKernelVersion(e.target.value);
                setDirty(true);
                setSaved(false);
              }}
              className={inputCls}
            >
              <option value="">Not set</option>
              {kernels.flatMap((k) =>
                k.knownVersions.map((v) => (
                  <option key={v} value={v}>
                    {k.label} — {v}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        {activeKernel && (
          <ul className="mt-3 list-inside list-disc text-xs leading-relaxed text-[var(--muted)]">
            {activeKernel.notes.slice(0, 3).map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass mt-4 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Smart ports (1–21)</h2>
          <span className="text-xs text-[var(--muted)]">
            {configuredCount} port{configuredCount === 1 ? "" : "s"} configured
          </span>
        </div>
        <div className="mt-2 flex flex-col">
          {SMART_PORTS.map((p) => renderPortRow(String(p), SMART_COMPONENT_TYPES))}
        </div>
      </section>

      <section className="glass mt-4 mb-8 rounded-xl p-4">
        <h2 className="text-sm font-semibold">ADI ports (A–H)</h2>
        <div className="mt-2 flex flex-col">
          {ADI_PORTS.map((p) => renderPortRow(p, ADI_COMPONENT_TYPES))}
        </div>
      </section>
    </main>
  );
}
