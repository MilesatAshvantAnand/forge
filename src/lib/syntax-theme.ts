import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

export function syntaxTheme(theme: "light" | "dark") {
  return theme === "light" ? oneLight : oneDark;
}
