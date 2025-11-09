/**
 * Degree Works HTML -> JSON converter (Browser version)
 * Converts HTML string to JSON object compatible with DegreeAudit schema
 */

function convertDegreeWorksHTML(htmlString) {
    // Parse HTML string into DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    function statusFromText(t) {
        const T = (t || "").toUpperCase();
        if (T.includes("REQUIREMENT IS COMPLETE")) return "COMPLETE";
        if (T.includes("IN-PROGRESS")) {
            if (T.includes("SHOULD BE COMPLETE") || T.includes("WHEN THE IN-PROGRESS CLASSES ARE COMPLETED")) {
                return "IN-PROGRESS"; // treat "PARTIAL" as IN-PROGRESS to match schema enum
            }
            return "IN-PROGRESS";
        }
        if (T.includes("SHOULD BE COMPLETE")) return "IN-PROGRESS"; // map partial-ish language to IN-PROGRESS
        if (T.includes("STILL NEEDED") || T.includes("INCOMPLETE")) return "INCOMPLETE";
        return "INCOMPLETE";
    }

    function textOf(el) {
        if (!el) return "";
        return el.textContent.replace(/\s+/g, " ").trim();
    }

    function findPaperCard(el) {
        // Ascend to a material-ui Paper card if present
        let node = el;
        for (let i = 0; i < 8 && node; i++) {
            const classes = node.className || "";
            if (classes.includes("MuiPaper-root")) return node;
            node = node.parentElement;
        }
        // Fallback to nearest block-level div
        return el.closest("div") || el;
    }

    function inferSbcFulfillment(sbcCategoryText) {
        const T = (sbcCategoryText || "").toUpperCase();
        if (T.includes("PARTIAL")) return "PARTIAL";
        // If you later know other markers (e.g. "(P)"), add them here
        return "FULL";
    }

    // Clean up noisy requirement titles (remove boilerplate, duplicate halves)
// Clean up noisy requirement titles (remove boilerplate, duplicate halves)
function cleanRequirementName(rawTitle) {
    if (!rawTitle) return "";
    let name = rawTitle;

    // Strip boilerplate phrases that DegreeWorks appends
    name = name.replace(/Requirement is complete/gi, "");
    name = name.replace(/Not complete/gi, "");
    name = name.replace(
        /When the in[- ]progress classes are completed this requirement should be complete/gi,
        ""
    );

    // Collapse whitespace
    name = name.replace(/\s+/g, " ").trim();
    if (!name) return "";

    // NEW: if the name is like "Software Engineering Software Engineering"
    // (same words repeated twice), drop it entirely.
    const tokens = name.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2 && tokens.length % 2 === 0) {
        const half = tokens.length / 2;
        const first = tokens.slice(0, half).join(" ").toUpperCase();
        const second = tokens.slice(half).join(" ").toUpperCase();
        if (first === second) {
            // Returning "" causes extractRequirements to skip this requirement
            return "";
        }
    }

    return name;
}
function extractStudent() {
    const student = {
        name: "",
        major: "",
        creditsRequired: 0,
        creditsApplied: 0,
    };

    const root = doc.body || doc.documentElement || doc;
    const text = textOf(root);

    // Pull structured labels (Level, Major, College, etc.)
    const labelMap = {};
    doc.querySelectorAll("dt").forEach(dt => {
        const label = textOf(dt).toLowerCase();
        if (!label) return;
        const val = textOf(dt.nextElementSibling);
        if (val) labelMap[label] = val;
    });

    // ---- NAME ----
    const nameLabel = doc.querySelector('[data-key="content-label"]');
    if (nameLabel) {
        student.name = textOf(nameLabel);
    } else {
        const nameMatch = text.match(/Academic Progress Report for\s+([A-Za-z,\s]+?)(?:Student Information|$)/i);
        if (nameMatch) {
            student.name = nameMatch[1].trim();
        }
    }

    // ---- MAJOR ----
    if (labelMap["major"]) {
        student.major = labelMap["major"];
    } else {
        const majorMatch = text.match(/Major in\s+(.+?)(?=\s*(?:Block|Section|Requirements?|College|Level|Overall|Catalog|Credits|Audit|$))/i);
        if (majorMatch) {
            student.major = majorMatch[1].trim();
        }
    }

    // ---- CREDITS ----
    const requiredMatch = text.match(/Credits required:\s*([\d.]+)/i);
    if (requiredMatch) student.creditsRequired = parseFloat(requiredMatch[1]);

    const appliedMatch = text.match(/Credits applied:\s*([\d.]+)/i);
    if (appliedMatch) student.creditsApplied = parseFloat(appliedMatch[1]);

    return student;
}

    function extractRequirements(defaultCatalogYear = "") {
        const reqs = [];
        const seen = new Set();

        const headerNodes = [
            ...doc.querySelectorAll("th"),
            ...doc.querySelectorAll('h3[id^="block-"]')
        ];

        headerNodes.forEach(node => {
            let titleText = "";

            if (node.tagName === "H3") {
                titleText = Array.from(node.childNodes || [])
                    .filter(child => child.nodeType === Node.TEXT_NODE)
                    .map(child => child.textContent || "")
                    .join(" ")
                    .trim();
                if (!titleText) {
                    titleText = textOf(node);
                }
            } else {
                titleText = textOf(node);
            }

            if (!titleText) return;

            const isReq =
                node.tagName === "H3" ||
                /Requirement/i.test(titleText) ||
                /^(Degree in )/i.test(titleText) ||
                /(General Education Requirements|Upper Division Credit Requirement|Major Requirements|Fall Through)/i.test(titleText);

            if (!isReq) return;

            const cleanTitle = cleanRequirementName(titleText);
            if (!cleanTitle) return;

            const card = findPaperCard(node);
            const cardText = textOf(card);

            const statusLabel =
                node.tagName === "H3"
                    ? textOf(node.querySelector('[id$="_statusLabel"]')) || statusFromText(cardText)
                    : statusFromText(cardText);

            const name = cleanTitle;
            const status = statusLabel || "INCOMPLETE";
            const mr = cardText.match(/Credits required:\s*(\d+)/i);
            const ma = cardText.match(/Credits applied:\s*(\d+)/i);
            const mcy = cardText.match(/Catalog year:\s*([A-Z]+\s+\d{4})/i);

            const req = {
                id: name.toLowerCase().replace(/\W+/g, "_").slice(0, 64),
                name,
                status,
                creditsRequired: mr ? parseInt(mr[1], 10) : undefined,
                creditsApplied: ma ? parseInt(ma[1], 10) : undefined,
                catalogYear: mcy
                    ? mcy[1].replace(/\b\w/g, c => c.toUpperCase())
                    : defaultCatalogYear
            };

            const key = `${req.name}|${req.creditsRequired}|${req.creditsApplied}|${req.catalogYear}`;
            if (!seen.has(key)) {
                seen.add(key);
                reqs.push(req);
            }
        });

        // Dedup by name (keep first)
        const uniq = [];
        const names = new Set();
        for (const r of reqs) {
            if (names.has(r.name)) continue;
            names.add(r.name);
            uniq.push(r);
        }
        return uniq;
    }
function extractCourses() {
    const completed = [];
    const inprog = [];
    const incomplete = []; // still empty until we know where pure "incomplete" rows live

    // helper: normalize cell texts for a row
    function getRowCells(tr) {
        return Array.from(tr.querySelectorAll("td, th")).map(td =>
            td.textContent.replace(/\s+/g, " ").trim()
        );
    }

    // helper: decide if a row looks like a course header row
    function isHeaderRow(cells) {
        const lower = cells.map(c => c.toLowerCase());
        const hasCourse  = lower.some(c => c.includes("course"));
        const hasTitle   = lower.some(c => c.includes("title"));
        const hasCredits = lower.some(c => c.includes("credit"));
        // need at least course + title + credits somewhere
        return hasCourse && hasTitle && hasCredits;
    }

    // helper: build an index map from header labels
    function buildHeaderIndexMap(cells) {
        const map = {};
        cells.forEach((text, idx) => {
            const t = text.toLowerCase();
            if (t.includes("course") && map.code == null)      map.code = idx;
            else if (t.includes("title") && map.title == null) map.title = idx;
            else if (t.includes("grade") && map.grade == null) map.grade = idx;
            else if (t.includes("credit") && map.credits == null) map.credits = idx;
            else if (t.includes("term") && map.term == null)   map.term = idx;
            else if ((t.includes("sbc") || t.includes("category")) && map.sbcCategory == null)
                map.sbcCategory = idx;
        });
        return map;
    }

    // go table-by-table so we can cross the thead/tbody boundary correctly
    const tables = Array.from(doc.querySelectorAll("table"));

    for (const table of tables) {
        const rows = Array.from(table.querySelectorAll("tr"));

        for (let i = 0; i < rows.length; i++) {
            const headerCells = getRowCells(rows[i]);
            if (!isHeaderRow(headerCells)) continue;

            const idxMap = buildHeaderIndexMap(headerCells);

            // if we didn't find at least code/title/credits, skip this header
            if (idxMap.code == null && idxMap.title == null && idxMap.credits == null) {
                continue;
            }

            // walk all rows after this header, stopping if we see a new header
            for (let r = i + 1; r < rows.length; r++) {
                const row = rows[r];
                const cells = getRowCells(row);

                if (!cells.length) continue;

                // stop when we hit another header row (start of another course table)
                if (isHeaderRow(cells)) break;

                const rowText = cells.join(" ").trim();
                if (!rowText) continue; // skip empty / spacer rows

                function at(idx) {
                    return idx != null && idx < cells.length ? cells[idx] : "";
                }

                const code        = at(idxMap.code);
                const title       = at(idxMap.title);
                const grade       = at(idxMap.grade);
                const creditsText = at(idxMap.credits);
                const term        = at(idxMap.term);
                const sbcCategory = at(idxMap.sbcCategory);

                // if there's no course code and no title, it's probably not a real course row
                if (!code && !title) continue;

                const creditsMatch = creditsText && creditsText.match(/(\d+(\.\d+)?)/);
                const creditsVal   = creditsMatch ? Number(creditsMatch[1]) : 0;

                const rowUpper = rowText.toUpperCase();
                if (rowUpper.includes("STILL NEEDED")) {
                    // Grab only the text AFTER "Still needed:"
                    let requirementText = "";
                    const mSN = rowText.match(/Still needed:\s*(.*)$/i);
                    if (mSN && mSN[1]) {
                        requirementText = mSN[1].trim();   // e.g. "1 Class in ECO 321" or "1 Class in ACC 210 or 311 or ..."
                    } else {
                        requirementText = rowText.replace(/^Still needed:\s*/i, "").trim();
                    }

                    if (!requirementText) {
                        continue;
                    }

                    const hasExcept = /Except/i.test(requirementText);
                    const hasOr = /\bor\b/i.test(requirementText); // "or" means multiple options

                    // Collect ALL course-like codes (ECO 321, CSE 310, etc.)
                    const codeMatches = [];
                    if (!hasExcept) {
                        const codeRe = /\b([A-Z]{3})\s*(\d{3}[A-Z]?)\b/g;
                        let m;
                        while ((m = codeRe.exec(requirementText)) !== null) {
                            codeMatches.push(`${m[1]} ${m[2]}`.replace(/\s+/, " "));
                        }
                    }

                    // We only treat it as a single missing course when:
                    //  - there is exactly ONE course code
                    //  - there is NO "Except"
                    //  - there is NO "or" (no multiple options)
                    if (!hasExcept && !hasOr && codeMatches.length === 1) {
                        const code = codeMatches[0];

                        // Try to derive the course name from the first cell in this row
                        let courseName = "";
                        if (cells[0]) {
                            let headerText = cells[0].replace(/\s+/g, " ").trim();
                            headerText = headerText
                                .replace(/Requirement is complete/gi, "")
                                .replace(/Not complete/gi, "")
                                .trim();

                            // Handle duplicated labels like "Computer Networks Computer Networks"
                            const tokens = headerText.split(/\s+/);
                            if (tokens.length && tokens.length % 2 === 0) {
                                const half = tokens.length / 2;
                                const first = tokens.slice(0, half).join(" ");
                                const second = tokens.slice(half).join(" ");
                                if (first.toUpperCase() === second.toUpperCase()) {
                                    headerText = first;
                                }
                            }

                            courseName = headerText;
                        }

                        incomplete.push({
                            code,                             // e.g. "CSE 310" / "ECO 321"
                            title: courseName || requirementText,  // e.g. "Computer Networks" / "Econometrics"
                            grade: null,
                            credits: creditsVal || 0,
                            term: "",
                            sbcCategory: "",
                            status: "INCOMPLETE"
                        });
                    } else {
                        // Multiple options, "Except", or no codes → treat as a generic requirement
                        // Title is just the options text: "1 Class in ACC 210 or 311 or 314 or ..."
                        incomplete.push({
                            code: "",
                            title: requirementText,
                            grade: null,
                            credits: creditsVal || 0,
                            term: "",
                            sbcCategory: "",
                            status: "INCOMPLETE"
                        });
                    }

                    // We've handled this "Still needed" row – skip normal course parsing for it
                    continue;
                }


                const looksLikeYearCredits = creditsVal > 10;
                const hasDigitInCode = /\d/.test(code || "");
                if (looksLikeYearCredits || !hasDigitInCode) continue;

                const baseCourse = {
                    code: code || "",
                    title: title || "",
                    grade: grade || null,
                    credits: creditsVal,
                    term: term || "",
                    sbcCategory: sbcCategory || "",
                    // full vs partial SBC fulfillment flag
                    sbcFulfillment: inferSbcFulfillment(sbcCategory)
                };

                const gradeEmpty = !baseCourse.grade || !String(baseCourse.grade).trim();
                const parenCredits = /[\(\)]/.test(creditsText || "");
                const termHasValue = !!(baseCourse.term && baseCourse.term.trim());
                const termFutureAndNoGrade =
                    /\b(FALL|SPRING|SUMMER|WINTER)\s+20\d{2}\b/i.test(baseCourse.term || "") &&
                    gradeEmpty;

                // Classification:
                //
                // 1. No grade AND no term  -> INCOMPLETE (planned / still-needed course row)
                // 2. Otherwise, if grade missing OR credits in parens OR future term with no grade
                //    -> IN-PROGRESS
                // 3. Everything else -> COMPLETE
                if (gradeEmpty && !termHasValue) {
                    incomplete.push({
                        ...baseCourse,
                        status: "INCOMPLETE",
                        note: "Listed in audit without a term/grade (likely still needed / planned)."
                    });
                } else if (gradeEmpty || parenCredits || termFutureAndNoGrade) {
                    inprog.push({
                        ...baseCourse,
                        status: "IN-PROGRESS"
                    });
                } else {
                    completed.push({
                        ...baseCourse,
                        grade: baseCourse.grade || "",
                        status: "COMPLETE"
                    });
                }
            }

            // we only expect one header per table; once processed, move to next table
            break;
        }
    }

    const takenCodes = new Set(
    [...completed, ...inprog]
        .map(c => (c.code || "").trim().toUpperCase())
        .filter(Boolean)
);

    // Codes we've already recorded as incomplete
    const incompleteCodes = new Set(
        incomplete
            .map(c => (c.code || "").trim().toUpperCase())
            .filter(Boolean)
    );

    const allEls = Array.from(doc.querySelectorAll("*"));

        allEls.forEach(el => {
            const tRaw = textOf(el);
            if (!tRaw) return;

            const t = tRaw.trim();
            if (!/^Still needed:/i.test(t)) return;

            // Remove "Still needed:" prefix
            const cleaned = t.replace(/^Still needed:\s*/i, "").trim();
            if (!cleaned) return;

            // Skip generic "Except ..." range rules here (already handled)
            if (/Except/i.test(cleaned)) return;

            // If this line has "or", it's a multi-option requirement
            // (ACC 210 or 311 or 314..., ECO 359 or 459, ESI or WRTD or ENG101)
            // → we *don't* want to create a separate single-course card.
            if (/\bor\b/i.test(cleaned)) return;

            // Count how many course codes appear
            const codeRe = /\b([A-Z]{3})\s*(\d{3}[A-Z]?)\b/g;
            const codes = [];
            let match;
            while ((match = codeRe.exec(cleaned)) !== null) {
                codes.push(`${match[1]} ${match[2]}`.replace(/\s+/, " "));
            }

            // Only handle simple things like "1 Class in ECO 321"
            if (codes.length !== 1) return;

            const code = codes[0];
            const key  = code.toUpperCase();

            // Don't add if it's already taken or already recorded as incomplete
            if (takenCodes.has(key) || incompleteCodes.has(key)) return;

            incomplete.push({
                code,
                title: cleaned,   // e.g. "1 Class in ECO 321"
                grade: null,
                credits: 0,
                term: "",
                sbcCategory: "",
                status: "INCOMPLETE"
            });

            incompleteCodes.add(key);
        });


    // ----- DEDUPE: DegreeWorks repeats the same course in multiple blocks -----
    function dedupeCourses(list) {
        const seen = new Set();
        const result = [];
        for (const c of list) {
            // same code + title + term + credits => treat as one course
            const key = [
                (c.code || '').trim().toUpperCase(),
                (c.title || '').trim().toUpperCase(),
                (c.term || '').trim().toUpperCase(),
                Number.isFinite(c.credits) ? c.credits : ''
            ].join('||');

            if (seen.has(key)) continue;
            seen.add(key);
            result.push(c);
        }
        return result;
    }

    const dedupCompleted = dedupeCourses(completed);
    const dedupInprog = dedupeCourses(inprog);

    return { completed: dedupCompleted, inprog: dedupInprog, incomplete };
}

// ---- Convert ----
const studentFull = extractStudent();
const requirements = extractRequirements(studentFull.catalogYear);
const { completed, inprog, incomplete } = extractCourses();

// Only expose the fields the UI actually uses
const student = {
    name: studentFull.name || "",
    major: studentFull.major || "",
    creditsRequired: Number.isFinite(studentFull.creditsRequired)
        ? studentFull.creditsRequired
        : 0,
    creditsApplied: Number.isFinite(studentFull.creditsApplied)
        ? studentFull.creditsApplied
        : 0
};

const outJson = {
    student,
    requirements,
    completedCourses: completed,
    inProgressCourses: inprog,
    incompleteCourses: incomplete,
    unmetConditions: []
};

// Ensure required fields present for requirements
outJson.requirements.forEach(r => {
    if (!r.id) r.id = (r.name || "unknown").toLowerCase().replace(/\W+/g, "_").slice(0, 64);
    if (!r.name) r.name = "Unknown Requirement";
    if (!r.status) r.status = "INCOMPLETE";
    if (!r.catalogYear) r.catalogYear = studentFull.catalogYear || "";
});

return outJson;

}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.convertDegreeWorksHTML = convertDegreeWorksHTML;
}

// For Node.js environments (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { convertDegreeWorksHTML };
}
