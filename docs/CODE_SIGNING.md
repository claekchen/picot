# macOS Code Signing & Notarization Setup

Picot's macOS builds are currently **ad-hoc signed** (`signingIdentity: "-"`
in `src-tauri/tauri.conf.json`), which is why Gatekeeper blocks first launch
(see the README's "macOS unsigned release notice"). `.github/workflows/release.yml`
is wired to sign + notarize automatically once the secrets below are
configured — no other code changes are needed. Until they're set, CI falls
back to the current ad-hoc behavior.

This is a one-time setup that requires an active Apple Developer Program
membership (the "developer license").

## 1. Create a Developer ID Application certificate

1. Open **Keychain Access** on a Mac → Certificate Assistant → Request a
   Certificate From a Certificate Authority, save the CSR to disk.
2. In the [Apple Developer portal](https://developer.apple.com/account/resources/certificates/add),
   create a new certificate of type **Developer ID Application**, upload
   the CSR, download the resulting `.cer`.
3. Double-click the downloaded `.cer` to import it into Keychain Access —
   it pairs with the private key generated in step 1.
4. In Keychain Access, find the cert under **My Certificates**, right-click
   → **Export**, save as `developerID.p12` with a password you choose.

## 2. Base64-encode the certificate

```bash
base64 -i developerID.p12 | pbcopy
```

## 3. Get your Team ID and an app-specific password

- **Team ID**: [developer.apple.com/account](https://developer.apple.com/account) → Membership details.
- **App-specific password**: [appleid.apple.com](https://appleid.apple.com) →
  Sign-In and Security → App-Specific Passwords → generate one (used only
  for notarization, not your main Apple ID password).

## 4. Add GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `APPLE_CERTIFICATE` | Output of the `base64` command above |
| `APPLE_CERTIFICATE_PASSWORD` | The password you set when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Your Name (TEAMID)` — exact string from `security find-identity -v -p codesigning` |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_PASSWORD` | The app-specific password from step 3 |
| `APPLE_TEAM_ID` | Your Team ID from step 3 |

(An App Store Connect API key — `APPLE_API_KEY`, `APPLE_API_ISSUER`,
`APPLE_API_KEY_PATH` — can be used instead of `APPLE_ID`/`APPLE_PASSWORD`;
swap the corresponding env vars in `release.yml` if you prefer that path.)

## 5. Cut a release

Push a `v*` tag as usual (see `docs/AUTO_UPDATER.md` / `scripts/release.sh`).
`tauri-action` will:

1. Import the certificate into a temporary keychain and codesign the
   `.app`/`.dmg` with `APPLE_SIGNING_IDENTITY`.
2. Submit the DMG to Apple's notary service using `APPLE_ID`/`APPLE_PASSWORD`/`APPLE_TEAM_ID`.
3. Staple the notarization ticket to the DMG.

The resulting DMG opens with a normal double-click — no Gatekeeper warning,
no right-click bypass.

## Local builds stay ad-hoc

`scripts/build.sh` (local QA builds) intentionally keeps using the ad-hoc
`signingIdentity: "-"` from `tauri.conf.json` — it has no access to your
Apple credentials and isn't meant for distribution. Only the CI release
path in `release.yml` is signed/notarized. If you also want signed local
builds, export the same env vars (`APPLE_CERTIFICATE`, etc.) before running
`tauri build` locally; `security find-identity -v -p codesigning` must show
the imported cert in your login keychain first.

## Once secrets are configured

Update `README.md`'s "macOS unsigned release notice" section and
`docs/BUILD.md`'s local-build signing note to stop describing the
right-click-Open workaround for **released** (CI-built) DMGs — it still
applies to local `scripts/build.sh` output.
