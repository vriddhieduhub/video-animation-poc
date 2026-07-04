// snapshot.js
import fs from "fs";
import path from "path";

const projectRoot = process.cwd();
const outputFile = path.join(projectRoot, "project_snapshot.txt");

const excluded = [
  "node_modules",
  "public",
  ".git",
  ".gitignore",
  "package-lock.json",
  "dist"
];
const excludedExtensions = [".md"];

function isExcluded(filePath) {
  const base = path.basename(filePath);
  const ext = path.extname(filePath);
  return excluded.includes(base) || excludedExtensions.includes(ext);
}

function getTree(dir, prefix = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !isExcluded(e.name));
  let tree = "";
  entries.forEach((entry, index) => {
    const isLast = index === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const fullPath = path.join(dir, entry.name);
    tree += `${prefix}${connector}${entry.name}\n`;
    if (entry.isDirectory()) {
      const newPrefix = prefix + (isLast ? "    " : "│   ");
      tree += getTree(fullPath, newPrefix);
    }
  });
  return tree;
}



function getCode(dir) {
  let codeDump = "";
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (isExcluded(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      codeDump += getCode(fullPath);
    } else {
      const ext = path.extname(entry.name);
      if ([".js", ".jsx", ".ts", ".tsx", ".json", ".css", ".html"].includes(ext)) {
        const content = fs.readFileSync(fullPath, "utf8");
         codeDump += `########################################################`;
        codeDump += `\n\n  ${fullPath.replace(projectRoot, "")}  \n`;
        codeDump += `########################################################
        ${content}\n`;
      }
    }
  }
  return codeDump;
}

function createSnapshot() {
  console.log("📸 Generating project snapshot...");
  let snapshot = "=== PROJECT TREE ===\n\n";
  snapshot += getTree(projectRoot);
  snapshot += "\n\n=== FILE CONTENTS ===\n";
  snapshot += getCode(projectRoot);
  fs.writeFileSync(outputFile, snapshot, "utf8");
  console.log(`✅ Snapshot saved to ${outputFile}`);
}

createSnapshot();
