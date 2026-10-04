<#--
  The shell every Keycloak email renders inside.

  ── COLOUR MAP: every literal in this file, and the login token it must equal ──
  Mail clients do not do custom properties, so colours here are INLINE LITERALS,
  repeated wherever they are used (attribute, inline style AND the <style>
  overrides). Each one is a copy of a login-theme token from
  login/resources/css/styles.css. When the palette is filled in or changed,
  replace each literal EVERYWHERE in this file (search for it) with the value
  of the token named beside it, so the mail and the login pages stay one brand:

    #F5F7FA   page ground (body, outer table)    = --p-surface
    #FFFFFF   card ground                        = --p-canvas
    #1F2933   body copy and the type wordmark    = --p-text
    #5B6573   footer line                        = --p-text-3
    #D9DEE5   card border                        = --p-border
    #334E68   rule under the wordmark            = --p-accent
    #334E68   links in the body                  = --p-accent-text

  The rule and the links share one literal by default. If --p-accent and
  --p-accent-text differ, the rule is the 3px cell's bgcolor + background-color;
  the links are the `.theme-body a` rule in <style>.

  (15px card radius = --p-radius-lg; not a colour, same rule applies.)
  Check the ink pairs on these grounds for contrast after substituting:
  --p-text and --p-accent-text on --p-canvas, --p-text-3 on --p-surface.

  Email is not the web, and this template is where that shows. Three constraints,
  none of which apply to the login theme:

  ── 1. No webfonts ─────────────────────────────────────────────────────────
  Outlook, the Gmail apps and most native clients ignore `@font-face`, so the
  brand typeface the login theme ships cannot be honoured here. The stack is
  system-first and the product's typography is deliberately not attempted. A
  recorded deviation, not an oversight — note it in the project's deviations.

  ── 2. No usable images ────────────────────────────────────────────────────
  Remote images are blocked by default in most clients, `data:` URI images are
  blocked by Gmail and Outlook too, and inline `<svg>` is stripped outright by
  both. There is no embedding that works everywhere — and a product mark is
  usually an SVG, which is the one format guaranteed to be stripped.

  So the brand here is TYPE: a text wordmark with an accent rule under it.
  Nothing to block, no requests, identical in every client, and nothing that
  lives outside the theme — the only surface where the brand is set in a
  typeface rather than drawn.

  `assetBaseUrl` in theme.properties is an OPT-IN that draws a PNG mark on top
  of that. It is empty by default because setting it makes the mail depend on a
  host outside the theme — see that file before touching it. Even then it is a
  PROGRESSIVE ENHANCEMENT, not a replacement: a client with images off falls all
  the way back to the words, which is why the type wordmark stays in the file.

  ── 3. Tables and inline style ─────────────────────────────────────────────
  A `<style>` block survives Gmail's web client but not several native ones, so
  everything load-bearing — widths, backgrounds, padding, colours — is an inline
  attribute on a table cell. The `<style>` block only carries refinements.
  Backgrounds are set with BOTH the `bgcolor` attribute and inline
  `background-color`, because Outlook reads the attribute and ignores the
  property.

  ── Why the ground is flat and near-white, whatever the login page does ────
  A login page ground may be a gradient, an image or a dark tint; in mail all of
  those are poor: CSS gradients are unsupported in Outlook, background images
  are blocked with the rest, clients in dark mode invert arbitrarily, and a
  tinted ground is the first thing they mangle. So the ground is ONE flat light
  colour (--p-surface; if the login ground is a gradient, use its lightest
  stop), dark ink on it, and the accent confined to the rule and the links. That
  survives being flipped, because inverted it is still the same contrast ratio.
-->
<#macro emailLayout>
<!DOCTYPE html>
<html lang="${locale.language}" dir="${(ltr)?then('ltr','rtl')}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${msg("themeEmailBrand")}</title>
<style>
  /* Refinements only — everything load-bearing is inline below. */
  body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; }
  table { border-collapse: collapse; }
  img { border: 0; line-height: 100%; }
  /* Keycloak's own copy arrives as bare <p> and <a>, so it is styled by element. */
  .theme-body p { margin: 0 0 14px; }
  .theme-body p:last-child { margin-bottom: 0; }
  .theme-body a { color: #334E68; text-decoration: underline; word-break: break-word; }
  .theme-body { word-break: break-word; }
  /* A client that forces its own dark scheme must not also invert ours.
     Verified in Chrome with prefers-color-scheme: dark — the mail stays light,
     so the standards path (Apple Mail, Gmail web, Thunderbird) is covered. */
  @media (prefers-color-scheme: dark) {
    .theme-shell, .theme-page { background-color: #F5F7FA !important; }
    .theme-card { background-color: #FFFFFF !important; }
  }
  /* ⚠️ OUTLOOK IS NOT ON THAT PATH. Its dark mode ignores prefers-color-scheme
     and the color-scheme metas, and rewrites the colours itself — observed in
     production: the whole mail came back dark grey while the rule above held
     fine everywhere else. Outlook tags what it rewrote with `data-ogsc` (text)
     and `data-ogsb` (background), which is the only handle it offers.

     These put back the things that must not move: the card ground and the
     ink on it. (If a band of REVERSED logos is ever added — see the comment at
     the bottom of the layout — it needs the same treatment, and it is the
     load-bearing one: white knockouts on a band flipped to a light ground
     vanish, so the failure is invisible content, not just an off colour.)

     Partial by nature. The attributes appear in the Outlook mobile apps and in
     some outlook.com builds, and not at all in others, so this reduces the blast
     radius rather than preventing inversion. The mail is designed to stay
     LEGIBLE inverted, which is the actual guarantee. */
  [data-ogsb] .theme-card,
  [data-ogsc] .theme-card { background-color: #FFFFFF !important; }
  [data-ogsc] .theme-body,
  [data-ogsc] .theme-body p,
  [data-ogsc] .theme-body td { color: #1F2933 !important; }
  @media only screen and (max-width: 480px) {
    .theme-card { padding: 22px 18px !important; }
    .theme-shell { padding: 18px 12px !important; }
  }
</style>
</head>
<body class="theme-page" bgcolor="#F5F7FA" style="margin:0; padding:0; background-color:#F5F7FA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F5F7FA" style="background-color:#F5F7FA;">
  <tr>
    <td align="center" class="theme-shell" bgcolor="#F5F7FA" style="padding:28px 16px; background-color:#F5F7FA;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; width:100%;">

        <#-- Brand, with an accent rule under it either way.

             By default the wordmark is TYPE — see constraint 2 above. The
             realm's display name, so it is the same name the footer and the
             login pages show. Letterspaced bold rather than italic: the brand
             face is not available here (constraint 1), and a system italic
             would invent a treatment the brand may not have. If the name is
             never slanted on the login pages, do not slant it here.

             The IMAGE branches, both opt-in:

             1. `x-mail-logo=img/logo.png` in theme.properties (preferred): the
                PNG ships INSIDE this theme (email/resources/img/) and Keycloak
                itself serves it — `url.resourcesUrl` is the absolute public URL
                of this email theme's resources. Self-contained, nothing to host.
                Measured on 26.6.1: the URL survives a restart, and an outdated
                version segment (after an upgrade) answers 307 to the current
                one, so the logo in an older mail keeps loading.
             2. `assetBaseUrl` — an image host OUTSIDE the theme. Only with the
                project owner's explicit OK (x-mail-images-hosted=true).

             Either way it is a REMOTE image to the mail client: Outlook and
             others hide it until the reader allows images. `alt` is the
             wordmark, so a blocked image still shows the brand as words. PNG,
             never SVG (Gmail and Outlook do not render SVG in <img>).

             `display:block` + `border:0` kill the baseline gap and Outlook's
             link border. WIDTH ONLY, with `height:auto` — pinning both in a
             client that ignores one would squash the artwork. -->
        <tr>
          <td align="left" style="padding:0 4px 14px;">
            <#if (properties["x-mail-logo"])?has_content && (url.resourcesUrl)??>
            <img src="${url.resourcesUrl}/${properties["x-mail-logo"]}" alt="${msg("themeEmailBrand")}" width="132"
                 style="display:block; width:132px; height:auto; border:0; outline:none; text-decoration:none;" />
            <#elseif properties.assetBaseUrl?has_content>
            <img src="${properties.assetBaseUrl}/brand.png" alt="${msg("themeEmailBrand")}" width="132"
                 style="display:block; width:132px; height:auto; border:0; outline:none; text-decoration:none;" />
            <#else>
            <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:17px; font-weight:700; letter-spacing:2px; color:#1F2933;">${msg("themeEmailBrand")}</span>
            </#if>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
              <tr><td bgcolor="#334E68" style="width:34px; height:3px; background-color:#334E68; font-size:0; line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>

        <#-- The card. Keycloak's message HTML lands in here verbatim. -->
        <tr>
          <td class="theme-card" bgcolor="#FFFFFF" style="background-color:#FFFFFF; border:1px solid #D9DEE5; border-radius:15px; padding:26px 24px;">
            <div class="theme-body" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:1.55; color:#1F2933;">
              <#nested>
            </div>
          </td>
        </tr>

        <#-- Which server sent this. The realm's DISPLAY name is the only identity
             Keycloak reliably provides here, and it is what tells a recipient
             the mail is genuine — so set Realm settings → Display name to the
             product's name, not to the realm id.

             The sentence itself is a message key, not a literal: Keycloak
             renders the body in the recipient's locale, and a hardcoded line
             would put one language under copy written in another. -->
        <tr>
          <td align="left" style="padding:14px 4px 18px;">
            <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:12px; line-height:1.5; color:#5B6573;">
              ${msg("themeEmailFooter", (realmName!"__BRAND__"))}
            </span>
          </td>
        </tr>

        <#-- ── Optional pattern: a partner / sponsor logo band ──────────────
             Not in the starter. Some projects must show partner or funder
             marks under every mail; if one does, it goes here, and the lessons
             from the theme this was extracted from apply:

             - It needs `assetBaseUrl` (logos are images), so it carries the
               same opt-in and the same explicit-OK requirement, and sits
               inside the same `if properties.assetBaseUrl?has_content` branch.
             - Partner logos are often REVERSED cuts (white/near-white fills),
               drawn for a dark ground. On this mail's light ground they would
               be invisible, so the band gets the dark ground they were drawn
               for (usually the brand's primary colour, = --p-accent). A logo
               that ships dark-on-light then needs an inverted PNG to match;
               change the band's colour and every logo has to be rechecked.
             - The band is load-bearing, not decoration: add it to BOTH dark
               mode blocks in <style> above (prefers-color-scheme and the
               Outlook [data-ogsb]/[data-ogsc] rules), or a flipped band hides
               every white knockout at once.
             - One cell per logo in a nested table, NOT flex: Outlook supports
               neither flexbox nor gap. Width per logo, chosen by eye — aspect
               ratios differ wildly, so equal widths look unequal. `height:auto`
               everywhere; `bgcolor` AND inline background-color on the band.
             - Each logo's `alt` is the partner's name, for blocked images. -->

      </table>

    </td>
  </tr>
</table>
</body>
</html>
</#macro>
