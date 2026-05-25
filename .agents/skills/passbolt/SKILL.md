---
name: passbolt
description: Use the @phy2vir/passbolt swamp vault extension to create Passbolt-backed vaults, store and read secrets safely, list keys, and wire vault references into models or workflows. Use when the user mentions Passbolt, @phy2vir/passbolt, passbolt CLI, swamp vault secrets, credential storage, vault:// references, or testing the Passbolt vault provider.
---

# Passbolt Vault

Use `@phy2vir/passbolt` when the user wants swamp secrets backed by a local
Passbolt account through the `passbolt` CLI.

## Safety Rules

- Never ask the user to paste secret values into chat.
- Prefer piped input or the interactive `swamp vault put <vault> <key>` prompt.
- Use dummy values for smoke tests.
- Do not commit generated vault configs, `.swamp/`, or secret material.
- Assume the `passbolt` CLI is already installed and authenticated unless the
  user asks for setup help.

## Create A Vault

```bash
swamp vault create @phy2vir/passbolt passbolt-secrets \
  --config '{"name_prefix":"swamp/"}' \
  --json
```

Optional config fields:

- `binary`: Passbolt CLI binary name or path. Defaults to `passbolt`.
- `config_file`: Optional Passbolt CLI config file path.
- `name_prefix`: Prefix for Passbolt resource names. Defaults to `swamp/`.

## Store Secrets

Use piped input for scripts:

```bash
printf '%s' "$API_KEY" | swamp vault put passbolt-secrets API_KEY
```

Use the interactive prompt for humans:

```bash
swamp vault put passbolt-secrets API_KEY
```

## Read And List

```bash
swamp vault list-keys passbolt-secrets --json
swamp vault read-secret passbolt-secrets API_KEY --force --json
```

Only reveal values when the user explicitly asks and the command is run locally.
Do not echo real secrets back into chat.

## Smoke Test

Use a test-only prefix so resources are easy to identify and clean up:

```bash
swamp vault create @phy2vir/passbolt passbolt-smoke \
  --config '{"name_prefix":"swamp-test/"}' \
  --json

printf '%s' 'dummy-test-value' \
  | swamp vault put passbolt-smoke SWAMP_TEST_KEY

swamp vault list-keys passbolt-smoke --json
swamp vault read-secret passbolt-smoke SWAMP_TEST_KEY --force --json
```

Expected result: `SWAMP_TEST_KEY` appears in `list-keys`, and reading it returns
`dummy-test-value`. In Passbolt, the resource name should be
`swamp-test/SWAMP_TEST_KEY`.

## Vault References

When wiring credentials into models or workflows, prefer vault references over
literal secrets:

```yaml
globalArguments:
  apiKey: vault://passbolt-secrets/API_KEY
```

Check the target model's docs for the exact argument name before wiring.
