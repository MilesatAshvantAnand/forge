"use client";

interface LogoBrand {
  name: string;
  sub?: string;
}

const BRANDS: LogoBrand[] = [
  { name: "HeyGen" },
  { name: "Qwen", sub: "Alibaba" },
  { name: "Cursor" },
  { name: "VEX V5" },
  { name: "FIRST Robotics" },
  { name: "Vercel" },
  { name: "Exa" },
  { name: "ElevenLabs" },
  { name: "Wispr Flow" },
];

function LogoChip({ brand }: { brand: LogoBrand }) {
  return (
    <div className="glass flex h-16 shrink-0 items-center justify-center gap-1.5 rounded-xl px-6">
      {brand.sub && (
        <span className="text-xs text-[var(--muted-subtle)]">{brand.sub}</span>
      )}
      <span className="text-sm font-semibold tracking-tight text-[var(--foreground-secondary)] whitespace-nowrap">
        {brand.name}
      </span>
    </div>
  );
}

export function LogoCarousel() {
  return (
    <div
      className="group relative w-full overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
      }}
    >
      <div className="marquee-track flex w-max items-center gap-3 group-hover:[animation-play-state:paused]">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center gap-3" aria-hidden={copy === 1}>
            {BRANDS.map((brand) => (
              <LogoChip key={`${copy}-${brand.name}`} brand={brand} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
