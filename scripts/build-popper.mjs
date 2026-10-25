import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const project = resolve("firmware/popper");
const core = process.env.PLATFORMIO_CORE_DIR || join(homedir(), ".platformio");
const bundled = join(core, "penv", process.platform === "win32" ? "Scripts/platformio.exe" : "bin/platformio");
const executable = process.env.PLATFORMIO || (existsSync(bundled) ? bundled : "platformio");
if (!process.argv.includes("--copy-only")) {
  const result = spawnSync(executable, ["run", "-d", project], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
const out = join(project, "bin");
mkdirSync(out, { recursive: true });
for (const name of ["firmware.bin", "bootloader.bin", "partitions.bin"]) {
  copyFileSync(join(project, ".pio/build/esp32dev", name), join(out, name));
}
copyFileSync(join(core, "packages/framework-arduinoespressif32/tools/partitions/boot_app0.bin"), join(out, "boot_app0.bin"));
console.log("Popper firmware bundled. No device was flashed.");
