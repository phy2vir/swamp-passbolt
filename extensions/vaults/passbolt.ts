/**
 * Passbolt vault provider that shells out to the local `passbolt` CLI.
 *
 * @module
 */

import { z } from "npm:zod@4";

/** Passbolt CLI configuration schema. */
const ConfigSchema = z.object({
  binary: z.string().default("passbolt").describe("Passbolt CLI binary"),
  config_file: z.string().optional().describe(
    "Optional Passbolt CLI config file path",
  ),
  name_prefix: z.string().default("swamp/").describe(
    "Prefix for Passbolt resource names",
  ),
}).passthrough();

/** Passbolt CLI configuration. */
type Config = z.infer<typeof ConfigSchema>;
type PassboltRecord = Record<string, unknown>;

class PassboltCliVaultProvider {
  constructor(
    private readonly name: string,
    private readonly config: Config,
  ) {}

  getName(): string {
    return this.name;
  }

  async get(secretKey: string): Promise<string> {
    const resource = await this.findResource(secretKey);
    if (!resource) {
      throw new Error(
        `Secret '${secretKey}' not found in Passbolt vault '${this.name}'`,
      );
    }
    const password = stringField(resource, ["Password", "password"]);
    if (password === undefined) {
      throw new Error(
        `Secret '${secretKey}' in Passbolt vault '${this.name}' has no password`,
      );
    }
    return password;
  }

  async put(secretKey: string, secretValue: string): Promise<void> {
    const resourceName = this.resourceName(secretKey);
    const existing = await this.findResource(secretKey);
    const args = existing
      ? [
        "update",
        "resource",
        "--id",
        requiredString(existing, ["ID", "Id", "id"]),
        "--name",
        resourceName,
        "--username",
        secretKey,
        "--password",
        secretValue,
      ]
      : [
        "create",
        "resource",
        "--name",
        resourceName,
        "--username",
        secretKey,
        "--password",
        secretValue,
      ];
    await this.runJson(args);
  }

  async list(): Promise<string[]> {
    const records = await this.resources();
    const bestByKey = new Map<string, PassboltRecord>();

    for (const record of records) {
      const resourceName = stringField(record, ["Name", "name"]);
      if (!resourceName || !resourceName.startsWith(this.config.name_prefix)) {
        continue;
      }
      const key = resourceName.slice(this.config.name_prefix.length);
      if (!key) continue;

      const current = bestByKey.get(key);
      if (!current || isNewer(record, current)) {
        bestByKey.set(key, record);
      }
    }

    return [...bestByKey.keys()].sort((a, b) => a.localeCompare(b));
  }

  private resourceName(secretKey: string): string {
    return `${this.config.name_prefix}${secretKey}`;
  }

  private async findResource(
    secretKey: string,
  ): Promise<PassboltRecord | null> {
    const target = this.resourceName(secretKey);
    const matches = (await this.resources()).filter((record) => {
      const resourceName = stringField(record, ["Name", "name"]);
      return resourceName === target;
    });
    if (matches.length === 0) return null;
    return matches.reduce((best, candidate) =>
      isNewer(candidate, best) ? candidate : best
    );
  }

  private async resources(): Promise<PassboltRecord[]> {
    const parsed = await this.runJson(["list", "resource"]);
    return extractRecords(parsed);
  }

  private async runJson(args: string[]): Promise<unknown> {
    const commandArgs = this.cliArgs([...args, "--json"]);
    const output = await new Deno.Command(this.config.binary, {
      args: commandArgs,
      stdout: "piped",
      stderr: "piped",
    }).output();

    const stdout = new TextDecoder().decode(output.stdout).trim();
    const stderr = new TextDecoder().decode(output.stderr).trim();
    if (output.code !== 0) {
      const detail = [stderr, stdout].filter(Boolean).join("\n");
      throw new Error(
        detail || `${this.config.binary} exited with code ${output.code}`,
      );
    }
    if (!stdout) {
      return null;
    }
    try {
      return JSON.parse(stdout) as unknown;
    } catch (error) {
      const detail = [stderr, stdout].filter(Boolean).join("\n");
      throw new Error(
        `Passbolt CLI returned non-JSON output: ${detail || String(error)}`,
      );
    }
  }

  private cliArgs(args: string[]): string[] {
    const cliArgs: string[] = [];
    if (this.config.config_file) {
      cliArgs.push("--config", this.config.config_file);
    }
    return [...cliArgs, ...args];
  }
}

function extractRecords(value: unknown): PassboltRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractRecords(item));
  }

  const record = asRecord(value);
  if (!record) return [];

  for (const key of ["body", "data", "items", "resources", "result"]) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      return nested.flatMap((item) => extractRecords(item));
    }
    const nestedRecord = asRecord(nested);
    if (nestedRecord) {
      return [nestedRecord];
    }
  }

  return [record];
}

function asRecord(value: unknown): PassboltRecord | null {
  return typeof value === "object" && value !== null
    ? value as PassboltRecord
    : null;
}

function stringField(
  record: PassboltRecord,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function requiredString(record: PassboltRecord, keys: string[]): string {
  const value = stringField(record, keys);
  if (!value) {
    throw new Error(`Missing required field: ${keys.join(" / ")}`);
  }
  return value;
}

function timestampValue(record: PassboltRecord): number {
  const raw = stringField(record, [
    "ModifiedTimestamp",
    "modified",
    "Modified",
    "ModifiedAt",
    "modified_at",
    "modifiedAt",
    "CreatedTimestamp",
    "created",
    "Created",
    "CreatedAt",
    "created_at",
    "createdAt",
  ]);
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isNewer(a: PassboltRecord, b: PassboltRecord): boolean {
  const aTime = timestampValue(a);
  const bTime = timestampValue(b);
  if (aTime !== bTime) return aTime > bTime;
  const aId = stringField(a, ["ID", "Id", "id"]) ?? "";
  const bId = stringField(b, ["ID", "Id", "id"]) ?? "";
  return aId > bId;
}

/** Passbolt CLI-backed vault provider. */
export const vault = {
  type: "@phy2vir/passbolt",
  name: "Passbolt CLI Vault",
  description:
    "Uses the local passbolt CLI for listing, reading, and writing resources.",
  configSchema: ConfigSchema,
  createProvider(name: string, config: Record<string, unknown>) {
    return new PassboltCliVaultProvider(name, ConfigSchema.parse(config));
  },
};
