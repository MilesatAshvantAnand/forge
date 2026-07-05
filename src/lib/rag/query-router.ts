export type QueryIntent = "project" | "external" | "hybrid" | "debug";

const DEBUG_SIGNALS =
  /drift|oscillat|stall|overshoot|undershoot|jam|slip|doesn'?t work|not working|broken|wrong|inconsistent|jerky|shak/i;
const EXTERNAL_SIGNALS =
  /how does (lemlib|pros|okapi|ez[- ]template|wpilib|road ?runner)|documentation|docs for|best practice|compare|difference between|what is (lemlib|pros|okapi|pure pursuit|odometry(?! in))|tutorial/i;
const PROJECT_SIGNALS =
  /where|find|this project|our |my code|in this repo|this file|explain th(is|e) (project|code|autonomous)|list (all|every)/i;

export function classifyQuery(query: string): QueryIntent {
  const isDebug = DEBUG_SIGNALS.test(query);
  const isExternal = EXTERNAL_SIGNALS.test(query);
  const isProject = PROJECT_SIGNALS.test(query);

  if (isDebug) return "debug";
  if (isExternal && isProject) return "hybrid";
  if (isExternal) return "external";
  return "project";
}

export function shouldSearchWeb(intent: QueryIntent): boolean {
  return intent === "external" || intent === "hybrid" || intent === "debug";
}
