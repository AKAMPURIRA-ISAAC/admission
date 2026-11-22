import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createAdmin, findAdminByUsername } from "../src/db.js";
import { hashPassword } from "../src/password.js";

async function askHidden(question) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Run this command in an interactive terminal so passwords are not exposed.");
  }

  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (key) => {
      if (key === "\u0003") {
        cleanup();
        reject(new Error("Admin setup was cancelled."));
      } else if (key === "\r" || key === "\n") {
        cleanup();
        stdout.write("\n");
        resolve(value);
      } else if (key === "\u007f" || key === "\b") {
        value = value.slice(0, -1);
      } else if (key >= " ") {
        value += key;
      }
    };
    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    const username = (await readline.question("Admin username: ")).trim();
    if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) {
      throw new Error("Username must be 3–80 characters and use letters, numbers, dots, underscores or hyphens.");
    }
    if (await findAdminByUsername(username)) {
      throw new Error("That admin username already exists.");
    }
    readline.close();

    const password = await askHidden("Password (at least 8 characters): ");
    const confirmation = await askHidden("Confirm password: ");
    if (password.length < 8 || password.length > 256) {
      throw new Error("Password must be between 8 and 256 characters.");
    }
    if (password !== confirmation) {
      throw new Error("Passwords do not match.");
    }

    const { passwordSalt, passwordHash } = await hashPassword(password);
    await createAdmin({ username, passwordSalt, passwordHash });
    stdout.write(`Admin account "${username}" created.\n`);
  } finally {
    readline.close();
  }
}

main().catch((error) => {
  console.error(`Admin setup failed: ${error.message}`);
  process.exitCode = 1;
});
