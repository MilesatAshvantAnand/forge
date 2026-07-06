/**
 * Bot Gateway — public API.
 *
 * "Understand the bot, not the code": every piece of generated C++ is checked
 * against the project's bot profile (firmware, kernel, port map) before it is
 * applied. See docs/bot-gateway.md for the architecture and philosophy.
 */

export type {
  BotComponent,
  BotProfile,
  GatewayCheck,
  GatewayReport,
  GatewaySeverity,
  GatewayVerdict,
} from "./types";

export { runGateway, RUBRIC_VERSION } from "./rubric";
export {
  getBotProfile,
  upsertBotProfile,
  deleteBotProfile,
  type BotProfileInput,
} from "./profile";
export {
  PROS_KERNELS,
  VEXOS_VERSIONS,
  API_RULES,
  kernelMajorOf,
  kernelInfo,
  type ProsKernelMajor,
  type ApiAvailabilityRule,
} from "./firmware-registry";
