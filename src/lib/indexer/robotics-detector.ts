import type {
  DetectedLibrary,
  Subsystem,
  ConstantEntry,
  PidEntry,
  AutonRoutine,
  SensorConfig,
} from "@/lib/types";
import type { ExtractedFile } from "./zip-parser";

interface LibrarySignature {
  name: string;
  patterns: RegExp[];
}

const LIBRARY_SIGNATURES: LibrarySignature[] = [
  { name: "PROS", patterns: [/#include\s+["<]pros\//, /pros::/, /project\.pros/] },
  { name: "LemLib", patterns: [/#include\s+["<]lemlib\//, /lemlib::/] },
  { name: "OkapiLib", patterns: [/#include\s+["<]okapi\//, /okapi::/] },
  { name: "EZ-Template", patterns: [/#include\s+["<]EZ-Template\//i, /\bez::/] },
  { name: "JAR-Template", patterns: [/JAR-Template/i, /#include\s+["<]JAR\//i] },
  { name: "VEXcode", patterns: [/#include\s+["<]vex_/, /\bvex::/] },
  { name: "WPILib", patterns: [/edu\.wpi\.first/, /#include\s+["<]frc\//, /frc::/] },
  { name: "FTC SDK", patterns: [/com\.qualcomm\.robotcore/, /org\.firstinspires\.ftc/] },
  { name: "Road Runner", patterns: [/com\.acmerobotics\.roadrunner/] },
  { name: "CTRE Phoenix", patterns: [/com\.ctre\.phoenix/, /ctre\/phoenix/] },
  { name: "REVLib", patterns: [/com\.revrobotics/, /rev\/CANSparkMax/] },
  { name: "PedroPathing", patterns: [/pedropathing/i] },
];

const SUBSYSTEM_KEYWORDS = [
  "intake", "drivetrain", "drive", "chassis", "arm", "lift", "shooter",
  "flywheel", "catapult", "claw", "clamp", "mogo", "elevator", "wings",
  "hang", "climb", "conveyor", "indexer", "hood", "turret", "wrist",
  "puncher", "descore", "doinker",
];

const SENSOR_PATTERNS: { type: string; pattern: RegExp }[] = [
  { type: "IMU / Inertial", pattern: /\b(Imu|IMU|Inertial|inertial|imu)\b.*[=({]/ },
  { type: "Rotation sensor", pattern: /\b(Rotation|rotation_sensor|RotationSensor)\b.*[=({]/ },
  { type: "Optical sensor", pattern: /\b(Optical|optical)\b.*[=({]/ },
  { type: "Distance sensor", pattern: /\b(Distance|DistanceSensor)\b.*[=({]/ },
  { type: "Encoder", pattern: /\b(Encoder|ADIEncoder|encoder)\b.*[=({]/ },
  { type: "Tracking wheel", pattern: /tracking[_ ]?wheel/i },
  { type: "GPS sensor", pattern: /\b(Gps|GPS)\b.*[=({]/ },
  { type: "Vision sensor", pattern: /\b(Vision|vision)\b.*[=({]/ },
  { type: "Limit switch", pattern: /\b(LimitSwitch|limit_switch)\b/ },
];

const CAPABILITY_CHECKS: { name: string; pattern: RegExp }[] = [
  { name: "Odometry", pattern: /odom|odometry|tracking[_ ]?wheel|pose/i },
  { name: "Motion profiling", pattern: /motion[_ ]?profil|trapezoid|s[_-]?curve|feedforward/i },
  { name: "Pure pursuit", pattern: /pure[_ ]?pursuit/i },
  { name: "PID control", pattern: /\bpid\b|kP|kI|kD/i },
  { name: "Autonomous selector", pattern: /auton[_ ]?select|autonomous[_ ]?select/i },
  { name: "Driver control curves", pattern: /drive[_ ]?curve|expo[_ ]?curve|joystick[_ ]?curve/i },
];

export function detectLibraries(fileList: ExtractedFile[]): DetectedLibrary[] {
  const found = new Map<string, Set<string>>();
  for (const file of fileList) {
    for (const sig of LIBRARY_SIGNATURES) {
      if (sig.patterns.some((p) => p.test(file.content) || p.test(file.path))) {
        if (!found.has(sig.name)) found.set(sig.name, new Set());
        const set = found.get(sig.name)!;
        if (set.size < 5) set.add(file.path);
      }
    }
  }
  return [...found.entries()].map(([name, evidence]) => ({
    name,
    confidence: evidence.size >= 2 ? "high" : "medium",
    evidence: [...evidence],
  }));
}

export function detectSubsystems(fileList: ExtractedFile[]): Subsystem[] {
  const map = new Map<string, Set<string>>();
  for (const file of fileList) {
    const lower = file.path.toLowerCase();
    for (const keyword of SUBSYSTEM_KEYWORDS) {
      const base = lower.split("/").pop() ?? "";
      if (base.includes(keyword) || lower.includes(`/${keyword}`)) {
        const canonical =
          keyword === "drive" || keyword === "chassis" ? "drivetrain" : keyword;
        if (!map.has(canonical)) map.set(canonical, new Set());
        map.get(canonical)!.add(file.path);
      }
    }
  }
  return [...map.entries()]
    .map(([name, filesSet]) => ({ name, files: [...filesSet] }))
    .sort((a, b) => b.files.length - a.files.length);
}

const CONSTANT_RE =
  /^\s*(?:#define\s+(\w+)\s+(.+?)\s*$|(?:static\s+)?(?:inline\s+)?constexpr\s+\w+\s+(\w+)\s*=\s*(.+?);|const\s+(?:int|double|float|auto|bool)\s+(\w+)\s*=\s*(.+?);|(?:public\s+)?static\s+final\s+\w+\s+(\w+)\s*=\s*(.+?);)/;

export function extractConstants(fileList: ExtractedFile[]): ConstantEntry[] {
  const constants: ConstantEntry[] = [];
  for (const file of fileList) {
    if (!/\.(cpp|hpp|c|h|java)$/.test(file.path)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length && constants.length < 300; i++) {
      const m = lines[i].match(CONSTANT_RE);
      if (!m) continue;
      const name = m[1] ?? m[3] ?? m[5] ?? m[7];
      const value = (m[2] ?? m[4] ?? m[6] ?? m[8])?.trim();
      if (name && value && !value.includes("(") /* skip function-ish values */) {
        constants.push({ name, value, file: file.path, line: i + 1 });
      }
    }
  }
  return constants;
}

const PID_LINE_RE = /(?:\b|_)k[pid](?:\b|_)|(?:\b|_)pid(?:\b|_)/i;

export function extractPidControllers(fileList: ExtractedFile[]): PidEntry[] {
  const entries: PidEntry[] = [];
  for (const file of fileList) {
    if (!/\.(cpp|hpp|c|h|java)$/.test(file.path)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length && entries.length < 100; i++) {
      const line = lines[i];
      if (!PID_LINE_RE.test(line)) continue;
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
      const nameMatch = trimmed.match(/(\w*(?:pid|k[pid]\b)\w*)/i);
      entries.push({
        name: nameMatch?.[1] ?? "PID constant",
        values: trimmed.slice(0, 120),
        file: file.path,
        line: i + 1,
      });
    }
  }
  return entries;
}

export function extractAutonRoutines(fileList: ExtractedFile[]): AutonRoutine[] {
  const routines: AutonRoutine[] = [];
  const fnRe = /(?:void|task|int|public\s+void)\s+(\w*(?:auton|auto_|skills|match|red|blue|left|right|solo|awp)\w*)\s*\(/i;
  for (const file of fileList) {
    const isAutonFile = /auton|auto(?!complete)|routine|skills/i.test(file.path);
    if (!/\.(cpp|hpp|c|h|java|py)$/.test(file.path)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length && routines.length < 50; i++) {
      const m = lines[i].match(fnRe);
      if (m && (isAutonFile || /auton|skills/i.test(m[1]))) {
        routines.push({ name: m[1], file: file.path, line: i + 1 });
      }
    }
  }
  // Dedupe declarations vs definitions: prefer implementation files
  const byName = new Map<string, AutonRoutine>();
  for (const r of routines) {
    const existing = byName.get(r.name);
    const isImpl = /\.(cpp|c|java|py)$/.test(r.file);
    if (!existing || (isImpl && !/\.(cpp|c|java|py)$/.test(existing.file))) {
      byName.set(r.name, r);
    }
  }
  return [...byName.values()];
}

export function extractSensors(fileList: ExtractedFile[]): SensorConfig[] {
  const sensors: SensorConfig[] = [];
  for (const file of fileList) {
    if (!/\.(cpp|hpp|c|h|java)$/.test(file.path)) continue;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length && sensors.length < 60; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
      for (const { type, pattern } of SENSOR_PATTERNS) {
        if (pattern.test(trimmed)) {
          sensors.push({ type, file: file.path, line: i + 1, snippet: trimmed.slice(0, 100) });
          break;
        }
      }
    }
  }
  return sensors;
}

export function detectCapabilities(fileList: ExtractedFile[]): string[] {
  const caps = new Set<string>();
  const allContent = fileList.map((f) => f.content).join("\n");
  for (const { name, pattern } of CAPABILITY_CHECKS) {
    if (pattern.test(allContent)) caps.add(name);
  }
  return [...caps];
}
