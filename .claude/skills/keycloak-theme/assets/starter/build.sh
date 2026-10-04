#!/usr/bin/env bash
#
# Gate every theme under src/theme/, then pack ONE JAR PER THEME into dist/.
#
#   ./build.sh                       → dist/<Theme>.jar for every theme
#   ./build.sh Ucll UcllRe           → only those (gates still run for them)
#   KC_CONTAINER=other ./build.sh    → nav/coverage checks against "other"
#
# One jar per theme, and every jar STANDALONE: each can be deployed, moved to
# another server, updated or removed on its own — no jar depends on another.
# Child themes (parent=<Base> in the source, where the shared layout lives
# once) are FLATTENED into their jar: the base's files and properties merged in,
# parent= rewritten to Keycloak's built-in theme. Bases get no jar.
#
# A jar is a zip: Keycloak reads META-INF/keycloak-themes.json to discover the
# theme and then serves theme/<name>/<type>/ straight out of the archive. Each
# jar gets its own descriptor, holding just its theme's entry from
# src/META-INF/keycloak-themes.json. That is why `src/theme/` is laid out as a themes directory and not as
# some build input — the same tree mounts at /opt/keycloak/themes for hot-reload
# development (dev/keycloak-compose.yaml), so there is one copy of the theme and
# no step that could leave the two out of step.
#
# EVERY theme under src/theme/ is gated and packed: one project can hold several
# (a theme per sub-brand, a login-only master-realm theme, environment variants
# built as child themes of one base). The types of each are whatever directories
# exist under src/theme/<name>/ (login, account, email, admin, …). ⚠️
# META-INF/keycloak-themes.json must list EXACTLY those themes and types: a type
# the JSON omits is never offered in the realm's theme dropdowns, and a type it
# lists with no directory behind it is a broken entry. The build fails when the
# two disagree.
#
# There is no build-time asset copy. Under the SELF-CONTAINED rule every font,
# image and colour a theme uses is committed inside src/theme/<name>/*/resources
# once, so the jar never depends on another tree being present (or being at the
# right version) when it is built.
set -euo pipefail

here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
src="$here/src"
dirs_of() { (cd "$1" && for d in */; do [ -d "$d" ] && echo "${d%/}"; done | sort); }

mapfile -t all_themes < <(dirs_of "$src/theme")
[ "${#all_themes[@]}" -gt 0 ] || { echo "  no themes under src/theme" >&2; exit 1; }
# A theme that other themes in src/theme inherit from (parent=<it>) is a BASE:
# a source-only layer. It gets no jar of its own — its children are flattened
# into standalone themes at pack time (tools/flatten-theme.mjs). Name it
# explicitly to build it anyway.
is_base() { grep -qs "^[[:space:]]*parent[[:space:]]*=[[:space:]]*$1[[:space:]]*$" "$src"/theme/*/*/theme.properties; }
if [ "$#" -gt 0 ]; then themes=("$@")
else themes=(); for t in "${all_themes[@]}"; do is_base "$t" || themes+=("$t"); done; fi
for t in "${themes[@]}"; do [ -d "$src/theme/$t" ] || { echo "  no theme src/theme/$t" >&2; exit 2; }; done
dist="$here/dist"
command -v node >/dev/null 2>&1 || { echo "  node is required (gates and the descriptor check)" >&2; exit 1; }

# Entries deliberately REMOVED from account/resources/content.json, by label
# space-separated (e.g. nav_omitted="applications"). The nav drift check below
# ignores exactly these. A plain string, not an array: an empty array trips
# `set -u` on the bash 3.2 that macOS still ships.
nav_omitted="applications"   # must match what resources/content.json leaves out (the starter drops Applications; ask the user)
kc_container="${KC_CONTAINER:-__CONTAINER__}"

# ── Descriptor: every theme and its types, exactly as on disk ────────────────
declared="$(node -e '
  const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  for (const t of d.themes) console.log(t.name + ": " + [...t.types].sort().join(" "));
' "$src/META-INF/keycloak-themes.json" | sort)"
on_disk="$(for t in "${all_themes[@]}"; do echo "$t: $(dirs_of "$src/theme/$t" | tr '\n' ' ' | sed 's/ $//')"; done | sort)"
if [ "$declared" != "$on_disk" ]; then
    echo "  ✗ keycloak-themes.json does not match src/theme:" >&2
    echo "    declared:" >&2; echo "$declared" | sed 's/^/      /' >&2
    echo "    on disk:"  >&2; echo "$on_disk"  | sed 's/^/      /' >&2
    exit 1
fi
echo "$on_disk" | sed 's/^/  /'

# ── Drift check: the account console's navigation ─────────────────────────────
# `account/resources/content.json`, when a theme ships one, must be a FULL
# copy of Keycloak's, because the console replaces its nav with ours rather than
# merging. That makes it the one file here that can silently fall behind: a
# Keycloak upgrade adding a tab would drop it.
#
# So compare against the running Keycloak's own copy when one is reachable, and
# say so when it is not. A warning, never a failure — the build must work with
# no Docker.
check_nav() {
    local ours="$1/account/resources/content.json"
    [ -f "$ours" ] || return 0
    command -v docker >/dev/null 2>&1 || { echo "  nav check skipped: no docker"; return; }
    docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$kc_container" \
        || { echo "  nav check skipped: container '$kc_container' not running"; return; }

    local jar tmp
    jar=$(docker exec "$kc_container" sh -c 'ls /opt/keycloak/lib/lib/main/*account-ui*.jar' 2>/dev/null | tr -d '\r') || {
        echo "  nav check skipped: no account-ui jar in '$kc_container'"; return; }
    tmp=$(mktemp -d)
    docker cp "$kc_container:$jar" "$tmp/account-ui.jar" >/dev/null 2>&1 || {
        rm -rf "$tmp"; echo "  nav check skipped: could not read $jar"; return; }
    unzip -p "$tmp/account-ui.jar" 'theme/keycloak.v3/account/resources/content.json' \
        > "$tmp/upstream.json" 2>/dev/null || {
        rm -rf "$tmp"; echo "  nav check skipped: no content.json in the account-ui jar"; return; }

    # Compare the label sets: ours must be upstream's minus the omitted entries.
    labels() { grep -o '"label"[[:space:]]*:[[:space:]]*"[^"]*"' "$1" | sed 's/.*"\([^"]*\)"$/\1/' | sort; }
    local missing
    missing=$(comm -23 <(labels "$tmp/upstream.json") <(labels "$ours") \
        | { if [ -n "$nav_omitted" ]; then grep -vxF "$(printf '%s\n' $nav_omitted)"; else cat; fi; } || true)
    if [ -n "$missing" ]; then
        echo "  ⚠ nav check: this Keycloak offers tabs our content.json does not list:"
        echo "$missing" | sed 's/^/      /'
        echo "    Re-derive it from theme/keycloak.v3/account/resources/content.json,"
        echo "    dropping only the entries in nav_omitted (build.sh)."
    else
        echo "  nav check: content.json matches this Keycloak${nav_omitted:+, minus $nav_omitted}"
    fi
    rm -rf "$tmp"
}

# ── Gates, per theme ─────────────────────────────────────────────────────────
# 1. self-contained: no CDN, no webfont services, no references to the app's
#    URLs, no placeholders left. A non-zero exit fails the build; if the script
#    is present it is mandatory.
# 2. coverage: fails the build when a class the login sequence emits has no
#    rule (how seventeen undeclared properties once shipped). Exits 0 with a
#    message when no Keycloak is reachable, so a build without Docker works.
# Both follow parent= to sibling themes, so child themes are checked through
# their base. (pipefail carries the exit statuses through the pipes.)
for theme in "${themes[@]}"; do
    echo "── $theme"
    if [ -f "$here/tools/check-self-contained.mjs" ]; then
        node "$here/tools/check-self-contained.mjs" "$src/theme/$theme" | sed 's/^/  /'
    fi
    check_nav "$src/theme/$theme"
    if [ -d "$src/theme/$theme/login" ]; then
        KC_CONTAINER="$kc_container" node "$here/tools/audit-coverage.mjs" "$theme" | tail -n 2 | sed 's/^/  /'
    fi
done

# ── Pack ─────────────────────────────────────────────────────────────────────
# -X drops the extra file attributes, so an unchanged tree produces a
# byte-identical jar and a rebuild does not show up as a diff.
#
# ⚠️ -X is only half of that. It strips the EXTRA attributes (uid, gid, and the
# high-precision times) but keeps each entry's DOS timestamp — so any step that
# copies or refreshes files into src/ (re-exporting a logo, re-subsetting a
# font, a script that syncs assets) must preserve mtimes: `cp -p`, not `cp`.
# With a plain `cp` the files were restamped on every run and two consecutive
# builds of an identical tree produced two different jars, which is exactly
# what this flag exists to prevent. Measured: the archives differed; with -p
# they hash the same.
#
# Windows without `zip` (Git Bash does not ship it): fall back to the bsdtar
# that Windows 10+ ships as System32\tar.exe, which writes zip archives. Git
# Bash's own `tar` is GNU tar and cannot. The fallback jar is valid but NOT
# byte-reproducible; install zip (e.g. `pacman -S zip` in MSYS2, or use WSL)
# when that matters — or do not commit the jars and build them at deploy time.
#
# Each theme is staged as META-INF/keycloak-themes.json (its own entry only,
# stamped with the source descriptor's mtime so it does not break
# reproducibility) + theme/<name>/ (copied with cp -p), then zipped.
win_tar="${SYSTEMROOT:-${SystemRoot:-C:/Windows}}/System32/tar.exe"
if command -v zip >/dev/null 2>&1; then packer=zip
elif [ -x "$(cygpath -u "$win_tar" 2>/dev/null || echo "$win_tar")" ]; then
    packer=bsdtar
    echo "  zip not found: packing with Windows bsdtar (jars will not be byte-reproducible)"
else
    echo "  zip is required but not installed" >&2; exit 1
fi
mkdir -p "$dist"
stage_root="$(mktemp -d)"
trap 'rm -rf "$stage_root"' EXIT
for theme in "${themes[@]}"; do
    stage="$stage_root/$theme"
    mkdir -p "$stage/META-INF" "$stage/theme"
    node -e '
      const [file, name] = process.argv.slice(1);
      const d = JSON.parse(require("fs").readFileSync(file, "utf8"));
      const t = d.themes.find(x => x.name === name);
      process.stdout.write(JSON.stringify({ themes: [t] }, null, 2) + "\n");
    ' "$src/META-INF/keycloak-themes.json" "$theme" > "$stage/META-INF/keycloak-themes.json"
    touch -r "$src/META-INF/keycloak-themes.json" "$stage/META-INF/keycloak-themes.json"
    node "$here/tools/flatten-theme.mjs" "$src/theme" "$theme" "$stage/theme"
    # The jar must stand alone: re-check the FLATTENED copy, which no longer has
    # a sibling parent to borrow from.
    node "$here/tools/check-self-contained.mjs" "$stage/theme/$theme" | tail -n 1 | sed 's/^/  flattened: /'
    out="$dist/$theme.jar"
    rm -f "$out"
    if [ "$packer" = zip ]; then
        ( cd "$stage" && zip -q -r -X "$out" META-INF theme -x '.*' -x '*/.*' )
    else
        "$(cygpath -u "$win_tar")" --format zip --exclude '.*' -c -f "$(cygpath -w "$out")" \
            -C "$(cygpath -w "$stage")" META-INF theme
    fi
    printf '  built dist/%s.jar (%s, standalone)\n' "$theme" "$(du -h "$out" | cut -f1 | tr -d ' ')"
done
for t in "${all_themes[@]}"; do
    is_base "$t" && [ "$#" -eq 0 ] && echo "  (no jar for $t: it is a base, flattened into its children)"
done
exit 0
