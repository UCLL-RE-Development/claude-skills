# diff-runs.awk — compare two filled ASVS 5.0 audit reports.
#
#   awk -f diff-runs.awk <old-run>/report.md <new-run>/report.md
#
# Optional helper. Requires only awk. Prints the movement sections for delta.md.
# Without awk, `diff old/report.md new/report.md` shows the same changes in raw form.

BEGIN {
    FS = "[ \t]*\\|[ \t]*"
    pass["PASS"] = 1
    bad["FAIL"] = 1; bad["PARTIAL"] = 1
    ver["PASS"] = 1; ver["FAIL"] = 1; ver["PARTIAL"] = 1
}

# Only the "## Full results" section is the record. The Open findings, Not-tested
# queue and Scope exclusions sections repeat requirement ids with different column
# layouts, so reading them would misalign Status and Sev. FNR==1 resets the flag
# at the start of each of the two files.
FNR == 1 { inFull = 0 }
/^##[ \t]/ { inFull = ($0 ~ /^##[ \t]+Full results[ \t]*$/); next }

inFull && $2 ~ /^V[0-9]+\.[0-9]+\.[0-9]+$/ {
    id = $2
    if (FNR == NR) {
        if (id in oldseen) next
        oldseen[id] = 1; old[id] = $5
    } else {
        if (id in newseen) next
        newseen[id] = 1
        new[id] = $5; lvl[id] = $3; tier[id] = $4; sev[id] = $6
        ev[id] = $7; note[id] = $8
        order[++n] = id
    }
}

function classify(o, c) {
    if (o == "")                        return "Added to scope"
    if (c == "")                        return "Removed from scope"
    if (o == c)                         return "Unchanged"
    if ((o in bad) && (c in pass))      return "Fixed"
    if ((o in pass) && (c in bad))      return "Regressed"
    if (o == "NOT_TESTED" && (c in ver))return "Newly tested"
    if ((o in ver) && c == "NOT_TESTED")return "Lost coverage"
    if (o == "N_A" || c == "N_A")       return "Scope change"
    return "Changed"
}

END {
    # requirements present in the old run but gone from the new one
    for (id in oldseen) if (!(id in newseen)) { order[++n] = id; new[id] = "" }

    split("Regressed Fixed|Lost coverage|Newly tested|Scope change|Changed|Added to scope|Removed from scope", tmp, "|")
    kinds[1] = "Regressed"; kinds[2] = "Fixed"; kinds[3] = "Lost coverage"
    kinds[4] = "Newly tested"; kinds[5] = "Scope change"; kinds[6] = "Changed"
    kinds[7] = "Added to scope"; kinds[8] = "Removed from scope"

    for (i = 1; i <= n; i++) {
        id = order[i]
        k = classify(old[id], new[id])
        kind[id] = k
        count[k]++
    }

    print "## Movement summary"
    print ""
    print "| Movement | Count |"
    print "| -------- | ----: |"
    any = 0
    for (j = 1; j <= 8; j++) if (count[kinds[j]] > 0) { printf "| %s | %d |\n", kinds[j], count[kinds[j]]; any = 1 }
    if (!any) print "| Unchanged | all |"

    for (j = 1; j <= 8; j++) {
        k = kinds[j]
        if (count[k] == 0) continue
        print ""
        printf "## %s (%d)\n", k, count[k]
        if (k == "Regressed") {
            print ""
            print "Highest-signal section. A regression with no matching code change points at a"
            print "deployment, edge or identity-provider change rather than the application."
        }
        print ""
        print "| Req | L | Tier | From | To | Sev | Evidence / note |"
        print "| --- | - | ---- | ---- | -- | --- | --------------- |"
        # emit in ASVS order: chapter, then section, then requirement
        for (c = 1; c <= 17; c++)
            for (i = 1; i <= n; i++) {
                id = order[i]
                if (kind[id] != k) continue
                ch = id; sub(/^V/, "", ch); sub(/\..*/, "", ch)
                if (ch + 0 != c) continue
                printf "| %s | %s | %s | %s | %s | %s | %s |\n", id,
                       lvl[id] == "" ? "?" : lvl[id], tier[id] == "" ? "?" : tier[id],
                       old[id] == "" ? "—" : old[id], new[id] == "" ? "—" : new[id],
                       sev[id] == "" ? "—" : sev[id],
                       (ev[id] note[id]) == "" ? "—" : (ev[id] (note[id] != "" ? " — " note[id] : ""))
            }
    }

    if (count["Regressed"] > 0) {
        printf "\n%d regression(s)\n", count["Regressed"] > "/dev/stderr"
        exit 1
    }
}
