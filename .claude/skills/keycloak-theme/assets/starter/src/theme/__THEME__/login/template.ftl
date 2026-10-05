<#--
  __THEME__ login theme — page shell. STARTER from the keycloak-theme skill.

  What to fill in here: normally NOTHING. The brand lock-up is switched by
  `x-brand-wordmark` in theme.properties, the brand's name comes from
  `brandName` in messages_<locale>.properties, and the look lives entirely in
  resources/css/styles.css. Every guard below exists because its absence once
  answered HTTP 500 or shipped a visible defect — the lessons are in
  `references/login.md` of the keycloak-theme skill. Keep them.
-->
<#import "footer.ftl" as loginFooter>

<#--
  Renderers for Keycloak's `themeResources` model, copied from 26.7's
  base/login/theme-resources.ftl.

  DEFINED HERE rather than imported, deliberately. Upstream does
  `<#import "theme-resources.ftl" as themeResourceTags>`, but that file does not
  exist before 26.7 and FreeMarker throws when an import cannot be resolved — so
  importing it would break this theme on exactly the versions it still has to
  run on. Guarding the import inside `<#if themeResources??>` would work but puts
  the namespace in a conditional scope, which is worse to read than three macros.

  The bodies only execute when `themeResources` exists, so `resource.hasDefer()`
  and `resource.blocking` — newer additions to the resource objects — are never
  dereferenced on an older server.

  Keep in step with upstream's copy if a release changes the attribute set.
-->
<#macro kteRenderStyles resources pathPrefix>
    <#list resources as resource>
        <link href="${pathPrefix}/${resource.path}" rel="stylesheet"<#if resource.media?has_content> media="${resource.media}"</#if><#if resource.integrity?has_content> integrity="${resource.integrity}"</#if><#if resource.crossorigin?has_content> crossorigin="${resource.crossorigin}"</#if> />
    </#list>
</#macro>

<#macro kteRenderScripts resources pathPrefix defaultScriptType="">
    <#list resources as resource>
        <script src="${pathPrefix}/${resource.path}"<#if resource.type?has_content> type="${resource.type}"<#elseif defaultScriptType?has_content> type="${defaultScriptType}"</#if><#if resource.integrity?has_content> integrity="${resource.integrity}"</#if><#if resource.crossorigin?has_content> crossorigin="${resource.crossorigin}"</#if><#if resource.hasDefer()> defer</#if><#if resource.hasAsync()> async</#if><#if resource.blocking?has_content> blocking="${resource.blocking}"</#if>></script>
    </#list>
</#macro>

<#macro kteRenderFavicons resources pathPrefix>
    <#list resources as resource>
        <link rel="${resource.rel!"icon"}"<#if resource.type?has_content> type="${resource.type}"</#if> href="${pathPrefix}/${resource.path}"<#if resource.media?has_content> media="${resource.media}"</#if> />
    </#list>
</#macro>

<#macro username>
  <#assign label>
    <#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if>
  </#assign>
  <div class="${properties.kcFormGroupClass!}">
    <label for="username" class="${properties.kcLabelClass!}">${label}</label>
    <div class="${properties.kcInputGroup!}">
      <div class="${properties.kcInputGroupItemClass!} ${properties.kcFill!}">
        <span class="${properties.kcInputClass!} ${properties.kcFormReadOnlyClass!}">
          <input id="kc-attempted-username" value="${auth.attemptedUsername}" readonly>
        </span>
      </div>
      <div class="${properties.kcInputGroupItemClass!}">
        <#-- Inline SVG rather than `<i class="fa-sync-alt fas">`: this theme
             loads no icon font, so the FontAwesome class drew an empty box. -->
        <button id="reset-login" class="${properties.kcFormPasswordVisibilityButtonClass!} kc-login-tooltip" type="button"
              aria-label="${msg('restartLoginTooltip')}" onclick="location.href='${url.loginRestartFlowUrl}'">
            <svg class="kc-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
              <path d="M8 2.5a5.5 5.5 0 1 0 5.28 7.06" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M8 0.6 L10.6 2.5 L8 4.4 Z" fill="currentColor"/>
            </svg>
            <span class="kc-tooltip-text">${msg("restartLoginTooltip")}</span>
        </button>
      </div>
    </div>
  </div>
</#macro>

<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<#assign kteColorMode = (properties["x-kte-color-mode"]!"system")?lower_case>
<#assign kteBrandWordmark = ((properties["x-brand-wordmark"]!"false")?lower_case == "true")>
<!DOCTYPE html>
<#--  ⚠️ Theme editors emit `lang="${lang}"`. There is no `lang` variable in
      Keycloak 26.0.2's login model — the whole theme threw
      InvalidReferenceException and every login page answered 500. Upstream
      reads `locale.currentLanguageTag`, and only inside an
      `internationalizationEnabled` guard because `locale` is absent otherwise.
      Parenthesised default so the guard covers the whole expression, and
      unconditional so `<html>` always carries a lang attribute — an
      unlabelled document is a WCAG 3.1.1 failure even in one language. -->
<html class="${properties.kcHtmlClass!}<#if kteColorMode == 'dark'> ${properties.kcDarkModeClass!'kcDarkModeClass pf-v5-theme-dark'}</#if>" lang="${(locale.currentLanguageTag)!'en'}"<#if realm.internationalizationEnabled> dir="${(locale.rtl)?then('rtl','ltr')}"</#if>>

<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="color-scheme" content="<#if kteColorMode == 'dark'>dark<#elseif kteColorMode == 'light'>light<#else>light dark</#if>">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <#if properties.meta?has_content>
        <#list properties.meta?split(' ') as meta>
            <meta name="${meta?split('==')[0]}" content="${meta?split('==')[1]}"/>
        </#list>
    </#if>
    <title>${msg("loginTitle",(realm.displayName!''))}</title>
    <#-- The favicon is the brand mark itself, img/logo.svg, declared
         image/svg+xml. One file rather than a raster ladder, and one fewer thing
         to regenerate when the mark changes. If the project ships a real favicon
         set, declare it through `themeResources` (26.7+) or add the links here —
         but only for files that are actually in resources/.

         ⚠️ The stock theme asks for `favicon.ico`, which a custom theme never
         ships — every page load 404s on it. Do not reinstate that line. -->
    <#if themeResources?? && themeResources.favicons?has_content>
        <@kteRenderFavicons themeResources.favicons url.resourcesPath />
    <#else>
        <#-- x-kte-favicon overrides the icon: a dark variant whose logo is a WHITE cut
             must point it at a coloured mark, or the tab icon vanishes on a light
             browser tab strip. -->
        <link rel="icon" type="image/svg+xml" href="${url.resourcesPath}/${properties["x-kte-favicon"]!"img/logo.svg"}" />
    </#if>
    <#-- Stylesheets and scripts, preferring the `themeResources` model.
         26.7 introduced it and made `properties.styles` / `properties.scripts`
         the `<#elseif>` fallback. That fallback still works — but a release that
         drops it would leave every page unstyled, with nothing in the theme to
         indicate why. Reading the new model first removes that cliff, and
         carries the per-resource `media`, `integrity`, `crossorigin`, `defer`,
         `async` and `blocking` attributes the flat space-separated property list
         cannot express. -->
    <#if themeResources?? && themeResources.stylesCommon?has_content>
        <@kteRenderStyles themeResources.stylesCommon url.resourcesCommonPath />
    <#elseif properties.stylesCommon?has_content>
        <#list properties.stylesCommon?split(' ') as style>
            <link href="${url.resourcesCommonPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if themeResources?? && themeResources.styles?has_content>
        <@kteRenderStyles themeResources.styles url.resourcesPath />
    <#elseif properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <script type="importmap">
        {
            "imports": {
                "rfc4648": "${url.resourcesCommonPath}/vendor/rfc4648/rfc4648.js"
            }
        }
    </script>
    <#-- Only when the theme follows the OS (x-kte-color-mode=system AND
         darkMode=true). `light` and `dark` are decided server-side above, so
         this script has nothing left to decide and is not emitted. -->
    <#if kteColorMode == 'system' && darkMode?? && darkMode>
      <script type="module" async blocking="render">
          const DARK_MODE_CLASS = "${properties.kcDarkModeClass!'kcDarkModeClass pf-v5-theme-dark'}";
          const darkModeClasses = DARK_MODE_CLASS.split(/\s+/).filter(Boolean);
          const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

          const syncDarkMode = () => updateDarkMode(mediaQuery.matches);

          syncDarkMode();
          if (!document.body) {
            document.addEventListener("DOMContentLoaded", syncDarkMode, { once: true });
          }
          mediaQuery.addEventListener("change", (event) => updateDarkMode(event.matches));

          function updateDarkMode(isEnabled) {
            const targets = [document.documentElement, document.body].filter(Boolean);

            for (const target of targets) {
              if (isEnabled) {
                target.classList.add(...darkModeClasses);
              } else {
                target.classList.remove(...darkModeClasses);
              }
            }
          }
      </script>
    </#if>
    <#if themeResources?? && themeResources.scripts?has_content>
        <@kteRenderScripts themeResources.scripts url.resourcesPath "text/javascript" />
    <#elseif properties.scripts?has_content>
        <#list properties.scripts?split(' ') as script>
            <script src="${url.resourcesPath}/${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <#if scripts??>
        <#list scripts as script>
            <script src="${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="module" src="${url.resourcesPath}/js/passwordVisibility.js"></script>
    <#-- Session polling: "if you sign in on another tab, move this one along".
         Keycloak renamed the function between versions — 26.0.2 exports
         `checkCookiesAndSetTimer`, later releases export `startSessionPolling`
         — with the same single-URL signature. ⚠️ A NAMED import of the newer
         name is a module-level SyntaxError on the older server: on 26.0.2 every
         page logged "does not provide an export named 'startSessionPolling'".

         A namespace import cannot fail that way, so this works on both. Also
         folded into one module with the auth-session check below, which imports
         from the same file — two `<script type="module">` blocks importing it
         fetch it once but report the same failure twice. -->
    <script type="module">
        <#outputformat "JavaScript">
        import * as authChecker from "${url.resourcesPath}/js/authChecker.js";

        const pollSession = authChecker.startSessionPolling
            ?? authChecker.checkCookiesAndSetTimer;
        pollSession?.("${url.ssoLoginInOtherTabsUrl}");

        <#-- ⚠️ Guard the FIELD, not just its parent: `authenticationSession`
             exists on 26.0.2 while `authSessionIdHash` does not, so testing the
             object alone enters the block and then throws on the `?c` — and a
             FreeMarker InvalidReferenceException means every page answers 500. -->
        <#if (authenticationSession.authSessionIdHash)??>
        authChecker.checkAuthSession?.(${authenticationSession.authSessionIdHash?c});
        </#if>
        </#outputformat>
    </script>
    <script type="module">
        document.addEventListener("click", (event) => {
            const link = event.target.closest("a[data-once-link]");

            if (!link) {
                return;
            }

            if (link.getAttribute("aria-disabled") === "true") {
                event.preventDefault();
                return;
            }

            const { disabledClass } = link.dataset;

            if (disabledClass) {
                link.classList.add(...disabledClass.trim().split(/\s+/));
            }

            link.setAttribute("role", "link");
            link.setAttribute("aria-disabled", "true");
        });
    </script>
</head>

<#-- ⚠️ `pageId` is another variable theme editors assume and 26.0.2 does not
     provide; emitted only when it exists, rather than defaulted to a made-up
     value. Nothing in styles.css keys off data-page-id — it is kept because a
     newer Keycloak does supply it and per-page hooks are useful to have. -->
<body id="keycloak-bg" class="${properties.kcBodyClass!}<#if kteColorMode == 'dark'> ${properties.kcDarkModeClass!'kcDarkModeClass pf-v5-theme-dark'}</#if>"<#if pageId??> data-page-id="login-${pageId}"</#if>>
<div class="${properties.kcLogin!}">
  <div class="${properties.kcLoginContainer!}">
    <main class="${properties.kcLoginMain!}">

      <#-- ── Brand lock-up and eyebrow ───────────────────────────────────────
           The lock-up and one eyebrow, centred, above the card. The eyebrow is
           Keycloak's own `#kc-page-title` rather than a string of ours: a fixed
           tagline would do for the sign-in screen, but this theme also draws
           password reset, OTP, update-password and twenty-odd others, and on
           those the page title is the only thing saying which one you are
           looking at. Reusing that slot means the eyebrow is always the right
           words and there is no copy to keep in step.

           The stock header renders the OIDC client name here instead. That
           resolves to the raw client id for a client with no display name, and
           for a client with none at all it falls back to the realm name —
           printing the same words twice, once as the brand and once underneath.
           When every client on the realm belongs to this one product and the
           product's own mark is directly above, there is no "which application
           asked for this?" left to answer. Render the client name in the
           eyebrow again if the realm serves a client that is not this product. -->
      <div class="${properties.kcLoginMainHeader!}">
        <header id="kc-header" class="${properties.kcHeaderClass!}">
          <div id="kc-header-wrapper" class="${properties.kcHeaderWrapperClass!}">
            <#-- ── The brand lock-up ───────────────────────────────────────
                 One switch, `x-brand-wordmark` in theme.properties.

                 Why it exists: a logo here is always loaded through <img>, a
                 sandboxed context no webfont can reach. Lettering inside the SVG
                 that is still live <text> therefore renders in whatever face the
                 client picked, not the brand's own — unless it is outlined to
                 vector paths.

                 false — the artwork already carries the name as paths, so the
                         file IS the wordmark. ONE element; the image carries
                         the brand's name as its accessible name and is NOT
                         aria-hidden.
                 true  — the artwork is a bare mark. It becomes decorative
                         (alt="") and the name is typed beside it in the
                         heading font, where the theme's @font-face applies
                         (`.kcBrandWordmark` in styles.css).

                 No width/height attributes: they would have to match the real
                 artwork's aspect ratio, which this starter cannot know. If the
                 project wants the space reserved before the image loads, add
                 width/height equal to the SVG's viewBox box (e.g. a 400×350
                 viewBox → width="400" height="350"); styles.css sizes it by
                 width with `height: auto`, so a wrong pair only distorts the
                 reservation — but get it right. -->
            <#if kteBrandWordmark>
            <img id="kc-brand-mark" src="${url.resourcesPath}/img/logo.svg" alt="" />
            <span id="kc-brand-wordmark" class="kcBrandWordmark">${msg("brandName")}</span>
            <#else>
            <img id="kc-brand-mark" src="${url.resourcesPath}/img/logo.svg" alt="${msg("brandName")}" />
            </#if>
          </div>
        </header>
        <h2 class="${properties.kcLoginMainTitle!}" id="kc-page-title"><#nested "header"></h2>
      </div>
      <div class="${properties.kcLoginMainBody!}">
        <#if !(auth?has_content && auth.showUsername() && !auth.showResetCredentials())>
            <#if displayRequiredFields>
                <div class="${properties.kcContentWrapperClass!}">
                    <div class="${properties.kcLabelWrapperClass!} subtitle">
                        <span class="${properties.kcInputHelperTextItemTextClass!}">
                          <span class="${properties.kcInputRequiredClass!}">*</span> ${msg("requiredFields")}
                        </span>
                    </div>
                </div>
            </#if>
        <#else>
            <#if displayRequiredFields>
                <div class="${properties.kcContentWrapperClass!}">
                    <div class="${properties.kcLabelWrapperClass!} subtitle">
                        <span class="${properties.kcInputHelperTextItemTextClass!}">
                          <span class="${properties.kcInputRequiredClass!}">*</span> ${msg("requiredFields")}
                        </span>
                    </div>
                    <div class="${properties.kcFormClass} ${properties.kcContentWrapperClass}">
                        <#nested "show-username">
                        <@username />
                    </div>
                </div>
            <#else>
                <div class="${properties.kcFormClass} ${properties.kcContentWrapperClass}">
                  <#nested "show-username">
                  <@username />
                </div>
            </#if>
        </#if>

        <#-- App-initiated actions should not see warning messages about the need to complete the action -->
        <#-- during login.                                                                               -->
                <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                    <div data-kc-class="kcAlertClass" class="${properties.kcAlertClass!} pf-m-${(message.type = 'error')?then('danger', message.type)}">
                        <div class="${properties.kcAlertIconClass!}">
                            <#if message.type = 'success'><span class="${properties.kcFeedbackSuccessIcon!}"></span></#if>
                            <#if message.type = 'warning'><span class="${properties.kcFeedbackWarningIcon!}"></span></#if>
                            <#if message.type = 'error'><span class="${properties.kcFeedbackErrorIcon!}"></span></#if>
                            <#if message.type = 'info'><span class="${properties.kcFeedbackInfoIcon!}"></span></#if>
                        </div>
                        <span class="${properties.kcAlertTitleClass!} kc-feedback-text">${message.summary}</span>
                    </div>
                </#if>
                <#-- The banner slot above the form, filled from the `infoMessage`
                     key. Empty (the default) = hidden. -->
                <#assign _infoMsg = msg("infoMessage")>
                <#assign _hasInfo = _infoMsg?has_content && !(displayMessage && message?has_content)>
                    <div id="kc-info-message" data-kc-class="kcAlertClass kcInfo" data-kc-i18n-key="infoMessage" class="${properties.kcAlertClass!} kcInfo"<#if !_hasInfo> style="display:none" aria-hidden="true"</#if>>
                        <div class="${properties.kcAlertIconClass!}">
                            <span class="${properties.kcFeedbackInfoIcon!}"></span>
                        </div>
                        <h1 class="${properties.kcAlertTitleClass!} kc-feedback-text"><#if _hasInfo>${_infoMsg}</#if></h1>
                    </div>

                <#nested "form">

        <#if auth?has_content && auth.showTryAnotherWayLink()>
          <form id="kc-select-try-another-way-form" action="${url.loginAction}" method="post" novalidate="novalidate">
              <input type="hidden" name="tryAnotherWay" value="on"/>
              <a id="try-another-way" href="javascript:document.forms['kc-select-try-another-way-form'].requestSubmit()"
                  class="${properties.kcButtonSecondaryClass} ${properties.kcButtonBlockClass} ${properties.kcMarginTopClass}">
                    ${msg("doTryAnotherWay")}
              </a>
          </form>
        </#if>

          <#if displayInfo>
            <#assign infoContent>
              <#nested "info">
            </#assign>
            <div id="kc-info" class="${properties.kcFormClass}">
              <div id="kc-info-wrapper" class="${properties.kcContentWrapperClass!}">
                ${infoContent?no_esc}
              </div>
            </div>
          </#if>

          <#-- "Sign in to a different organization", from 26.7's base shell.
               Only rendered on an Organizations-enabled realm — but a control
               that exists upstream and silently does not exist here is the kind
               of gap nobody discovers until they turn the feature on.
               `switchOrganizationEnabled??` keeps it inert on every older
               version, where the variable is simply absent. -->
          <#if switchOrganizationEnabled?? && switchOrganizationEnabled>
              <form id="kc-switch-organization-form" action="${url.loginAction}" method="post">
                  <div class="${properties.kcFormGroupClass!}">
                      <input type="hidden" name="switchOrganization" value="true"/>
                      <a href="#" id="switch-organization"
                         onclick="document.forms['kc-switch-organization-form'].requestSubmit();return false;">${msg("doSwitchOrganization")}</a>
                  </div>
              </form>
          </#if>

                <#nested "socialProviders">

          <#-- Footer band: legal links (footer.ftl, only when their message keys
               are non-empty) and the language picker (only when the realm has
               Internationalization on with more than one locale). With neither,
               nothing is rendered — not even the rule above it. -->
          <#assign hasLanguageSelector = realm.internationalizationEnabled && locale.supported?size gt 1>
          <#assign hasLegalLinks = msg("imprintUrl")?has_content || msg("dataProtectionUrl")?has_content>
          <#if hasLegalLinks || hasLanguageSelector>
            <div class="${properties.kcLoginMainFooter!}">
              <div class="${properties.kcLoginMainFooterBand!} kc-footer-row">
                <#if hasLegalLinks>
                  <@loginFooter.content/>
                </#if>
                <#if hasLanguageSelector>
                  <div class="${properties.kcLoginMainFooterBandItem!} kc-footer-language">
                    <select
                      aria-label="${msg("languages")}"
                      id="login-select-toggle"
                      class="kc-language-select"
                      onchange="if (this.value) window.location.href=this.value"
                    >
                      <#list locale.supported?sort_by("label") as l>
                        <option
                          value="${l.url}"
                          ${(l.languageTag == locale.currentLanguageTag)?then('selected','')}
                        >
                          ${l.label}
                        </option>
                      </#list>
                    </select>
                  </div>
                </#if>
              </div>
            </div>
          </#if>
      </div>
    </main>
  </div>
</div>
</body>
</html>

</#macro>
