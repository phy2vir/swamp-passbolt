# Passbolt Swamp Vault

This vault shells out to the local `passbolt` CLI and maps each swamp secret to
one Passbolt resource. Resource names are `${name_prefix}${key}` and the secret
value is stored in the resource password field.

## Prerequisites

- The local `passbolt` CLI installed and already configured for your account.
- A valid local CLI session or auth setup that can run non-interactively from
  the terminal.

This provider does not manage JWT login, GPG encryption, or metadata
serialization itself. It relies on the CLI to talk to your Passbolt instance in
the same way you use it interactively.

## Create a vault

```bash
swamp vault create @phy2vir/passbolt passbolt-secrets \
  --config '{"name_prefix":"swamp/"}' \
  --json
```

## Use it

```bash
printf '%s' "$API_KEY" | swamp vault put passbolt-secrets API_KEY
swamp vault list-keys passbolt-secrets --json
swamp vault read-secret passbolt-secrets API_KEY --force --json
```

The `name_prefix` defaults to `swamp/`. Resources created outside that prefix
are ignored by this vault.

Do not paste secret values into chat. Pipe them locally or use the interactive
`swamp vault put passbolt-secrets KEY` prompt.
