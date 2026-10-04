#!/usr/bin/env bash
#
# Start the dev Keycloak, point a preview realm at this theme, send a test
# mail, and print the links to look at. Safe to re-run: it updates what exists.
#
#   ./dev/preview.sh [ThemeName] [--master]          (from the theme root)
#
#   ThemeName   defaults to the only folder under src/theme/
#   --master    ALSO apply the theme's login (and admin) type to the master
#               realm: the sign-in page of the master admin console. Only on
#               this throwaway server; see references/admin.md before ever
#               doing that on a real one.
#   PREVIEW_LOCALES  the realm's locales, first = default (default: en,nl)
#   KC_PORT     defaults to 8087, MAIL_PORT to 8025 (read by the compose file
#               too, so two previews can run side by side)
#
# Each preview realm gets its OWN admin console, signed in to that realm, so
# the theme's admin type is visible without touching master:
#   <base>/admin/<realm>/console/   as   realm-admin / admin
#
# Leaves Keycloak RUNNING so the pages can be looked at. Stop it with:
#   docker compose -f dev/keycloak-compose.yaml down
#
# Everything here is local and throwaway (admin/admin, a test user with
# password "test", sslRequired=NONE). Never point it at a real Keycloak.
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash: do not rewrite /opt/... paths for docker exec

here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd -- "$here/.." && pwd)"
compose="$here/keycloak-compose.yaml"
# docker.exe needs a Windows path when this runs in Git Bash (path conversion is off above).
command -v cygpath >/dev/null 2>&1 && compose="$(cygpath -w "$compose")"
port="${KC_PORT:-8087}"
mail_port="${MAIL_PORT:-8025}"
base="http://localhost:$port"
# The realm's locales, first = default. Use the ones the real realm offers
# (SKILL.md Step 1): the sign-in page's language links list exactly these.
#   PREVIEW_LOCALES=nl,en ./dev/preview.sh
locales="${PREVIEW_LOCALES:-en,nl}"
locales_json="[\"${locales//,/\",\"}\"]"

theme=""; on_master=false
for a in "$@"; do
    case "$a" in
        --master) on_master=true ;;
        -*) echo "unknown option $a" >&2; exit 2 ;;
        *) theme="$a" ;;
    esac
done
if [ -z "$theme" ]; then
    mapfile -t found < <(ls -1 "$root/src/theme")
    [ "${#found[@]}" -eq 1 ] || { echo "several themes under src/theme — pass one: ${found[*]}" >&2; exit 2; }
    theme="${found[0]}"
fi
[ -d "$root/src/theme/$theme" ] || { echo "no theme src/theme/$theme" >&2; exit 2; }
realm="$(echo "$theme" | tr '[:upper:]' '[:lower:]')-preview"
has() { [ -d "$root/src/theme/$theme/$1" ]; }

# ── Up ──────────────────────────────────────────────────────────────────────
docker compose -f "$compose" up -d >/dev/null
container="$(docker compose -f "$compose" ps -q keycloak)"
printf 'waiting for Keycloak on %s ' "$base"
# Status captured in a variable, not piped into `grep -q`: under pipefail, grep
# exiting early SIGPIPEs curl and the check fails even when Keycloak is up.
status() { curl -s -o /dev/null -w '%{http_code}' "$base/realms/master" 2>/dev/null || true; }
for _ in $(seq 1 90); do
    [ "$(status)" = 200 ] && break
    printf '.'; sleep 2
done
[ "$(status)" = 200 ] || { echo " gave up"; exit 1; }
echo " up"

kc() { docker exec "$container" /opt/keycloak/bin/kcadm.sh "$@"; }
kc config credentials --server http://localhost:8080 --realm master --user admin --password admin >/dev/null 2>&1

# ── Realm: created once, themes re-applied every run ─────────────────────────
themes=()
has login   && themes+=(-s "loginTheme=$theme")
has account && themes+=(-s "accountTheme=$theme")
has email   && themes+=(-s "emailTheme=$theme")
has admin   && themes+=(-s "adminTheme=$theme")
# A type removed from the theme must not stay selected: the realm would point
# at a theme with no admin type behind it.
has admin   || themes+=(-s "adminTheme=keycloak.v2")
if kc get "realms/$realm" >/dev/null 2>&1; then
    [ "${#themes[@]}" -gt 0 ] && kc update "realms/$realm" "${themes[@]}"
else
    # rememberMe / reset / registration on, so those controls actually appear.
    kc create realms -s "realm=$realm" -s enabled=true -s "displayName=$theme" "${themes[@]}" \
        -s rememberMe=true -s resetPasswordAllowed=true -s registrationAllowed=true \
        -s internationalizationEnabled=true -s "defaultLocale=${locales%%,*}" \
        -s "supportedLocales=$locales_json" -s sslRequired=NONE \
        -s 'smtpServer.host=mailhog' -s 'smtpServer.port=1025' -s 'smtpServer.from=noreply@theme.local' >/dev/null
    kc create users -r "$realm" -s username=tester -s enabled=true -s email=tester@theme.local \
        -s emailVerified=true -s firstName=Test -s lastName=User >/dev/null
    kc set-password -r "$realm" --username tester --new-password test
    # A public client with no PKCE requirement, so login and register can be
    # opened from a plain link (account-console demands a PKCE challenge).
    kc create clients -r "$realm" -s clientId=theme-preview -s publicClient=true \
        -s standardFlowEnabled=true -s "redirectUris=[\"$base/realms/$realm/account/*\"]" >/dev/null
fi

# The admin theme is resolved from the realm you SIGN IN to. A realm-scoped
# administrator signs in to the preview realm itself, so its admin console
# wears this theme (and its sign-in page this theme's login) with master left
# alone. Created on every run if missing, so older preview realms get one too.
if has admin && ! kc get users -r "$realm" -q username=realm-admin --fields id 2>/dev/null | grep -q '"id"'; then
    kc create users -r "$realm" -s username=realm-admin -s enabled=true -s email=realm-admin@theme.local \
        -s emailVerified=true -s firstName=Realm -s lastName=Admin >/dev/null
    kc set-password -r "$realm" --username realm-admin --new-password admin
    kc add-roles -r "$realm" --uusername realm-admin --cclientid realm-management --rolename realm-admin
fi

if $on_master; then
    master_themes=()
    has login && master_themes+=(-s "loginTheme=$theme")
    has admin && master_themes+=(-s "adminTheme=$theme")
    [ "${#master_themes[@]}" -gt 0 ] && kc update realms/master "${master_themes[@]}"
fi

# ── A real mail through the email theme ─────────────────────────────────────
mailed=""
if has email; then
    uid="$(kc get users -r "$realm" -q username=tester --fields id --format csv --noquotes | tr -d '\r' | head -1)"
    kc update "users/$uid/execute-actions-email" -r "$realm" -b '["UPDATE_PASSWORD"]' >/dev/null 2>&1 \
        && mailed="sent (Update password)" || mailed="could not send — check the server log for 'Failed to template email'"
fi

# ── Links ───────────────────────────────────────────────────────────────────
enc() { local s="$1"; s="${s//:/%3A}"; echo "${s//\//%2F}"; }
back="$(enc "$base/realms/$realm/account/")"
auth="client_id=theme-preview&response_type=code&scope=openid&redirect_uri=$back"
echo
echo "Theme \"$theme\" is live on realm \"$realm\". Edits under src/theme show on reload"
echo "(hard-reload, or devtools \"Disable cache\": the browser caches theme files)."
echo
if has login; then
    echo "  Sign in            $base/realms/$realm/protocol/openid-connect/auth?$auth"
    echo "  Register           $base/realms/$realm/protocol/openid-connect/registrations?$auth"
    echo "  Forgot password    $base/realms/$realm/login-actions/reset-credentials?client_id=theme-preview"
fi
has account && echo "  Account console    $base/realms/$realm/account/        (tester / test)"
has email   && echo "  Mail (MailHog)     http://localhost:$mail_port                   test mail: $mailed"
has admin   && echo "  Admin console      $base/admin/$realm/console/        (realm-admin / admin)"
$on_master  && echo "  Master sign-in     $base/admin/master/console/        (admin / admin)"
echo
echo "  Pages behind a flow (OTP, recovery codes, …): tools/harness/index.html"
echo "  Stop:  docker compose -f dev/keycloak-compose.yaml down"
