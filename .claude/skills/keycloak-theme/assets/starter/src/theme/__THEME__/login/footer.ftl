<#--
  __THEME__ login theme — optional legal links under the form. STARTER from the
  keycloak-theme skill.

  What to fill in: nothing here. Set `imprintUrl` / `dataProtectionUrl` (and
  their labels) in messages_<locale>.properties to make a link appear; each one
  renders only when its URL key is non-empty, and with both empty this macro
  renders nothing at all. Lessons: `references/login.md` in the keycloak-theme
  skill.

  ⚠️ The keys must EXIST, even empty. `msg()` on a key that is missing from every
  bundle returns the key itself, which has content — so the footer would render
  `<a href="imprintUrl">imprintLabel</a>`.
-->
<#macro content>
    <#if msg("imprintUrl")?has_content || msg("dataProtectionUrl")?has_content>
        <div class="${properties.kcLoginMainFooterBand!} kc-footer-legal-links">
            <#if msg("imprintUrl")?has_content>
                <a href="${msg("imprintUrl")}" class="${properties.kcLoginMainFooterBandItem!}" target="_blank" rel="noopener noreferrer">${msg("imprintLabel")}</a>
            </#if>
            <#if msg("dataProtectionUrl")?has_content>
                <a href="${msg("dataProtectionUrl")}" class="${properties.kcLoginMainFooterBandItem!}" target="_blank" rel="noopener noreferrer">${msg("dataProtectionLabel")}</a>
            </#if>
        </div>
    </#if>
</#macro>
