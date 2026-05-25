import { vault } from "./passbolt.ts";

function assertEquals<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

Deno.test("Passbolt config applies defaults", () => {
  const config = vault.configSchema.parse({});
  assertEquals(config.binary, "passbolt");
  assertEquals(config.name_prefix, "swamp/");
  assertEquals(config.config_file, undefined);
});

Deno.test("Passbolt config keeps legacy fields", () => {
  const config = vault.configSchema.parse({
    server_url: "https://passbolt.example.com",
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    recipient: "87C7E9B63401BF5592D7A106FFF3FC4F8F8C6F89",
  });
  assertEquals(
    config.server_url,
    "https://passbolt.example.com",
  );
  assertEquals(
    config.user_id,
    "550e8400-e29b-41d4-a716-446655440000",
  );
  assertEquals(
    config.recipient,
    "87C7E9B63401BF5592D7A106FFF3FC4F8F8C6F89",
  );
});

Deno.test("Passbolt provider keeps the vault name", () => {
  const provider = vault.createProvider("passbolt-secrets", {});
  assertEquals(provider.getName(), "passbolt-secrets");
});
