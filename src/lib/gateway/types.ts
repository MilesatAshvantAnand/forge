/**
 * Bot Gateway — shared types.
 *
 * A BotProfile is the source-of-truth description of the exact robot a
 * project targets: firmware, PROS kernel, brain, and the full port map.
 * The gateway validates every piece of generated code against this profile
 * before it can be applied ("understand the bot, not the code").
 */

/** One physical device plugged into the brain. */
export interface BotComponent {
  /** Smart port 1–21, or ADI port "A"–"H". */
  port: number | string;
  /**
   * Component type id, e.g. "motor_11w", "motor_5_5w", "rotation_sensor",
   * "imu", "distance", "optical", "vision", "gps", "radio", "adi_digital_in",
   * "adi_digital_out", "adi_analog_in", "adi_encoder", "adi_potentiometer".
   */
  type: string;
  /** Human label, e.g. "left front drive". */
  label: string;
  /** Motors only: spins reversed. */
  reversed?: boolean;
  /** Motors only: cartridge, e.g. "blue_600" | "green_200" | "red_100". */
  gearset?: string;
}

export interface BotProfile {
  id: string;
  projectId: string;
  name: string;
  /** VEXos version, e.g. "1.1.5". */
  firmwareVersion: string | null;
  /** PROS kernel version, e.g. "4.1.1" or "3.8.3". */
  prosKernelVersion: string | null;
  brainType: string;
  components: BotComponent[];
  rubricVersion: string;
  createdAt: number;
  updatedAt: number;
}

export type GatewaySeverity = "error" | "warning" | "info";

export interface GatewayCheck {
  /** Stable check id, e.g. "port-unknown", "kernel-api", "syntax-braces". */
  id: string;
  severity: GatewaySeverity;
  message: string;
  /** 1-based line in the checked code, when attributable. */
  line?: number;
}

export type GatewayVerdict = "pass" | "warn" | "fail";

export interface GatewayReport {
  verdict: GatewayVerdict;
  /** 0–100; 100 = clean pass. */
  score: number;
  checks: GatewayCheck[];
  rubricVersion: string;
  /** Profile the code was checked against (name only, for display). */
  profileName: string;
}
