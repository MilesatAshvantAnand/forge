import type {
  GraphNode,
  GraphEdge,
  Subsystem,
  DetectedLibrary,
  FileTreeNode,
} from "@/lib/types";
import type { ExtractedFile } from "./zip-parser";

export function buildFileTree(fileList: ExtractedFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const sorted = [...fileList].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    const parts = file.path.split("/");
    let level = root;
    let currentPath = "";
    for (let i = 0; i < parts.length; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      const isFile = i === parts.length - 1;
      let node = level.find((n) => n.name === parts[i]);
      if (!node) {
        node = {
          name: parts[i],
          path: currentPath,
          type: isFile ? "file" : "directory",
          ...(isFile ? {} : { children: [] }),
        };
        level.push(node);
      }
      if (!isFile) level = node.children!;
    }
  }

  const sortLevel = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1
    );
    nodes.forEach((n) => n.children && sortLevel(n.children));
  };
  sortLevel(root);
  return root;
}

export function buildProjectGraph(
  projectName: string,
  subsystems: Subsystem[],
  libraries: DetectedLibrary[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [
    { id: "project", type: "project", label: projectName },
  ];
  const edges: GraphEdge[] = [];

  for (const lib of libraries) {
    const id = `lib-${lib.name}`;
    nodes.push({ id, type: "library", label: lib.name });
    edges.push({ id: `e-project-${id}`, source: "project", target: id });
  }

  for (const sub of subsystems.slice(0, 8)) {
    const subId = `sub-${sub.name}`;
    nodes.push({ id: subId, type: "subsystem", label: sub.name });
    edges.push({ id: `e-project-${subId}`, source: "project", target: subId });

    for (const file of sub.files.slice(0, 4)) {
      const fileId = `file-${file}`;
      if (!nodes.find((n) => n.id === fileId)) {
        nodes.push({
          id: fileId,
          type: "file",
          label: file.split("/").pop() ?? file,
          file,
        });
      }
      edges.push({ id: `e-${subId}-${fileId}`, source: subId, target: fileId });
    }
  }

  return { nodes, edges };
}
