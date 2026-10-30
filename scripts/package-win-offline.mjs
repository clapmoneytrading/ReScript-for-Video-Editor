/**
 * Assemble an offline Windows installer from the `nsis-web` output.
 *
 * The one-file NSIS target fails on machines where 32-bit makensis cannot
 * mmap the ~200 MB payload ("Internal compiler error #12345"). The web
 * installer sidesteps that by keeping the payload in a separate .7z — and its
 * install script checks `$EXEDIR` for that package (hash-verified) before it
 * ever tries to download. So Setup.exe + the .7z in one folder is a complete
 * offline installer. This script puts them together and zips the folder.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const webDir = join(root, "dist", "nsis-web");
const outDir = join(root, "dist", "Rescript-Windows-Offline");

if (!existsSync(webDir)) {
  console.error(`[package-win-offline] ${webDir} not found — run the nsis-web build first`);
  process.exit(1);
}

const setup = readdirSync(webDir).find((f) => /^Rescript.*Setup.*\.exe$/i.test(f) && !/uninstaller/i.test(f));
const pkg = readdirSync(webDir).find((f) => /\.nsis\.7z$/i.test(f));
if (!setup || !pkg) {
  console.error(`[package-win-offline] expected Setup.exe and *.nsis.7z in ${webDir}, found: ${readdirSync(webDir).join(", ")}`);
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
copyFileSync(join(webDir, setup), join(outDir, setup));
copyFileSync(join(webDir, pkg), join(outDir, pkg));
console.log(`[package-win-offline] ${outDir}\\${setup} (+ ${pkg})`);

if (process.platform === "win32") {
  const zip = join(root, "dist", "Rescript-Windows-Offline.zip");
  rmSync(zip, { force: true });
  const res = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", `Compress-Archive -Path '${outDir}\\*' -DestinationPath '${zip}' -Force`],
    { stdio: "inherit" }
  );
  if (res.status === 0) console.log(`[package-win-offline] ${zip}`);
}
