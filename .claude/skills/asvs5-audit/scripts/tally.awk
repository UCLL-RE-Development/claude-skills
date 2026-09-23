# tally.awk — recompute every summary table of a filled ASVS 5.0 audit report.
#
#   awk -f tally.awk <run-dir>/report.md
#
# Optional helper. Requires only awk, which ships with every Unix system and with
# Git Bash on Windows. Writes the summary tables to stdout ready to paste back in,
# and never modifies the report.
#
# Only the "## Full results" section is read. The Open findings, Not-tested queue
# and Scope exclusions sections are derived views with different column layouts,
# and parsing them would misread severities as statuses. If the file has no
# "## Full results" heading — a pasted fragment, say — every requirement row in it
# is read instead.
#
# See references/report-spec.md for the formulas and the data-quality rules.

BEGIN {
    FS = "[ \t]*\\|[ \t]*"
    split("PASS FAIL PARTIAL N_A NOT_TESTED", st, " ")
    split("critical high medium low", sv, " ")
    for (i in st) known[st[i]] = 1
    for (i in sv) knownsev[sv[i]] = 1
    nprob = 0
}

# A level-2 heading switches sections. "### V1 — …" is level 3 and does not.
/^##[ \t]/ { inFull = ($0 ~ /^##[ \t]+Full results[ \t]*$/); next }

# Buffer every requirement row with the section it came from; choose at END.
$2 ~ /^V[0-9]+\.[0-9]+\.[0-9]+$/ {
    N++
    b_id[N] = $2; b_lvl[N] = $3; b_tier[N] = $4
    b_stat[N] = $5; b_sev[N] = $6; b_ev[N] = $7; b_note[N] = $8
    b_full[N] = inFull
    if (inFull) nfull++
}

function coverage(pass, fail, part, na, scope,   app, ver) {
    app = scope - na; ver = pass + fail + part
    return app > 0 ? sprintf("%.1f%%", 100 * ver / app) : "—"
}
function scoreof(pass, fail, part,   ver) {
    ver = pass + fail + part
    return ver > 0 ? sprintf("%.1f%%", 100 * (pass + 0.5 * part) / ver) : "—"
}
function share(x, app) { return app > 0 ? sprintf("%.1f%%", 100 * x / app) : "—" }
function bare(s) { sub(/%$/, "", s); return s }

END {
    if (N == 0) {
        print "no requirement rows found — is this a filled report.md?" > "/dev/stderr"
        exit 1
    }
    if (nfull == 0)
        print "note: no '## Full results' heading found; reading every requirement row in the file" > "/dev/stderr"

    for (k = 1; k <= N; k++) {
        if (nfull > 0 && !b_full[k]) continue
        id = b_id[k]
        if (id in seen) { prob[++nprob] = id ": duplicate row in Full results"; continue }
        seen[id] = 1

        status = b_stat[k]; sev = b_sev[k]; ev = b_ev[k]; note = b_note[k]
        tier = b_tier[k]; sub(/\+.*/, "", tier)            # "T1+T2" -> primary tier T1
        ch = id; sub(/^V/, "", ch); sub(/\..*/, "", ch); ch = "V" ch
        lnum = b_lvl[k]; gsub(/[^0-9]/, "", lnum); lnum += 0

        if (!(status in known)) { prob[++nprob] = id ": unknown status \"" status "\""; continue }

        n++
        chapters[ch] = 1
        scope_ch[ch]++; scope_tier[tier]++; scope_lvl[lnum]++
        cnt[ch, status]++; tcnt[tier, status]++; lcnt[lnum, status]++; total[status]++
        if (status == "FAIL" || status == "PARTIAL") {
            if (!(sev in knownsev)) prob[++nprob] = id ": " status " without a valid severity"
            else sevcount[sev]++
            if (ev == "") prob[++nprob] = id ": " status " without evidence"
        }
        else if (status == "PASS" && ev == "") prob[++nprob] = id ": PASS without evidence"
        else if (status == "N_A" && note == "") prob[++nprob] = id ": N_A without justification"
        if (lnum > maxlvl) maxlvl = lnum
    }

    if (n == 0) {
        print "no usable requirement rows — every row failed to parse" > "/dev/stderr"
        exit 1
    }

    app = n - total["N_A"]
    ver = total["PASS"] + total["FAIL"] + total["PARTIAL"]

    # ── Scorecard: fixed keys, fixed order, for cross-report aggregation ──
    print "## Scorecard"
    print ""
    print "```"
    print "asvs_version   5.0.0"
    printf "target_level   L%d\n", maxlvl
    print "run_id         <unchanged>"
    print "date           <unchanged>"
    print "stack          <unchanged>"
    printf "scope          %d\n", n
    printf "pass           %d\n", total["PASS"] + 0
    printf "fail           %d\n", total["FAIL"] + 0
    printf "partial        %d\n", total["PARTIAL"] + 0
    printf "na             %d\n", total["N_A"] + 0
    printf "not_tested     %d\n", total["NOT_TESTED"] + 0
    printf "coverage       %s\n", bare(coverage(total["PASS"], total["FAIL"], total["PARTIAL"], total["N_A"], n))
    printf "score          %s\n", bare(scoreof(total["PASS"], total["FAIL"], total["PARTIAL"]))
    for (L = 1; L <= maxlvl; L++) {
        f = pa = nt = 0
        for (k = 1; k <= L; k++) { f += lcnt[k, "FAIL"]; pa += lcnt[k, "PARTIAL"]; nt += lcnt[k, "NOT_TESTED"] }
        printf "verified_l%d    %s\n", L, (f == 0 && pa == 0 && nt == 0) ? "yes" : "no"
    }
    printf "open_critical  %d\n", sevcount["critical"] + 0
    printf "open_high      %d\n", sevcount["high"] + 0
    printf "open_medium    %d\n", sevcount["medium"] + 0
    printf "open_low       %d\n", sevcount["low"] + 0
    split("T1 T2 T3", tt, " ")
    for (i = 1; i <= 3; i++) {
        t = tt[i]
        printf "t%d_coverage    %s\n", i,
               bare(coverage(tcnt[t, "PASS"], tcnt[t, "FAIL"], tcnt[t, "PARTIAL"], tcnt[t, "N_A"], scope_tier[t]))
    }
    print "```"
    print ""

    print "## Verdict"
    print ""
    print "| Level | Certification | Failing | Outstanding | Score | Coverage |"
    print "| ----- | ------------- | ------: | ----------: | ----: | -------: |"
    for (L = 1; L <= maxlvl; L++) {
        p = f = pa = na = nt = s = 0
        for (k = 1; k <= L; k++) {
            p += lcnt[k, "PASS"]; f += lcnt[k, "FAIL"]; pa += lcnt[k, "PARTIAL"]
            na += lcnt[k, "N_A"]; nt += lcnt[k, "NOT_TESTED"]; s += scope_lvl[k]
        }
        cert = (f == 0 && pa == 0 && nt == 0) ? "VERIFIED" : "NOT VERIFIED"
        printf "| L%d | %s | %d | %d | %s | %s |\n", L, cert, f + pa, nt,
               scoreof(p, f, pa), coverage(p, f, pa, na, s)
    }

    print ""
    print "## Totals"
    print ""
    print "| Status | Count | Share of applicable |"
    print "| ---------- | ----: | ------------------: |"
    # explicit and ordered, so the table always reads the same way between runs
    printf "| %-10s | %d | %s |\n", "PASS",       total["PASS"] + 0,       share(total["PASS"], app)
    printf "| %-10s | %d | %s |\n", "FAIL",       total["FAIL"] + 0,       share(total["FAIL"], app)
    printf "| %-10s | %d | %s |\n", "PARTIAL",    total["PARTIAL"] + 0,    share(total["PARTIAL"], app)
    printf "| %-10s | %d | %s |\n", "NOT_TESTED", total["NOT_TESTED"] + 0, share(total["NOT_TESTED"], app)
    printf "| %-10s | %d | excluded |\n", "N_A",  total["N_A"] + 0

    print ""
    print "### Open findings by severity"
    print ""
    print "| Severity | Count |"
    print "| -------- | ----: |"
    for (i = 1; i <= 4; i++) printf "| %-8s | %d |\n", sv[i], sevcount[sv[i]] + 0

    print ""
    print "## Coverage by verification tier"
    print ""
    print "| Tier | Scope | Verified | Coverage | Score | Fail | Partial | N/A |"
    print "| ---- | ----: | -------: | -------: | ----: | ---: | ------: | --: |"
    lbl["T1"] = "T1 code review + local tooling"
    lbl["T2"] = "T2 DAST / testing suites"
    lbl["T3"] = "T3 manual (docs, config, process)"
    for (i = 1; i <= 3; i++) {
        t = tt[i]
        p = tcnt[t, "PASS"]; f = tcnt[t, "FAIL"]; pa = tcnt[t, "PARTIAL"]; na = tcnt[t, "N_A"]
        printf "| %s | %d | %d | %s | %s | %d | %d | %d |\n", lbl[t], scope_tier[t] + 0,
               p + f + pa, coverage(p, f, pa, na, scope_tier[t]), scoreof(p, f, pa), f + 0, pa + 0, na + 0
    }

    print ""
    print "## By chapter"
    print ""
    print "| Chapter | Scope | Pass | Fail | Part | N/A | Not tested | Coverage | Score |"
    print "| ------- | ----: | ---: | ---: | ---: | --: | ---------: | -------: | ----: |"
    for (c = 1; c <= 17; c++) {
        ch = "V" c
        if (!(ch in chapters)) continue
        p = cnt[ch, "PASS"]; f = cnt[ch, "FAIL"]; pa = cnt[ch, "PARTIAL"]
        na = cnt[ch, "N_A"]; nt = cnt[ch, "NOT_TESTED"]
        printf "| %s | %d | %d | %d | %d | %d | %d | %s | %s |\n", ch, scope_ch[ch],
               p + 0, f + 0, pa + 0, na + 0, nt + 0,
               coverage(p, f, pa, na, scope_ch[ch]), scoreof(p, f, pa)
    }
    printf "| **Total** | **%d** | %d | %d | %d | %d | %d | %s | %s |\n", n,
           total["PASS"] + 0, total["FAIL"] + 0, total["PARTIAL"] + 0,
           total["N_A"] + 0, total["NOT_TESTED"] + 0,
           coverage(total["PASS"], total["FAIL"], total["PARTIAL"], total["N_A"], n),
           scoreof(total["PASS"], total["FAIL"], total["PARTIAL"])

    print ""
    printf "<!-- score %s at coverage %s — %d of %d applicable requirements verified -->\n",
           scoreof(total["PASS"], total["FAIL"], total["PARTIAL"]),
           coverage(total["PASS"], total["FAIL"], total["PARTIAL"], total["N_A"], n), ver, app

    if (nprob > 0) {
        print "" > "/dev/stderr"
        print "## Data-quality problems (" nprob ")" > "/dev/stderr"
        for (i = 1; i <= nprob; i++) print "  " prob[i] > "/dev/stderr"
        print "\nfix these before trusting the numbers above" > "/dev/stderr"
        exit 2
    }
}
