// Configuration
const SAMPLE_DEGREE_WORKS_HTML = 'degree-works.sample.html';

// Global store for the full data so click handlers can use it
let DEGREE_AUDIT_DATA = null;

// File with recommended classes (full Spring 2026 schedule)
const SCHEDULE_FILE = 'sbu_schedule_spring2026.json';

// Global store for schedule data
let SCHEDULE_DATA = [];

// Load schedule JSON once so requirement clicks can use it
async function loadSchedule() {
    try {
        const res = await fetch(SCHEDULE_FILE);
        if (!res.ok) throw new Error(`HTTP error fetching ${SCHEDULE_FILE}: ${res.status}`);
        SCHEDULE_DATA = await res.json();
        console.log('📚 Loaded schedule entries:', SCHEDULE_DATA.length);
    } catch (err) {
        console.error('❌ Error loading schedule data:', err);
        SCHEDULE_DATA = [];
    }
}

async function fetchLatestDegreeWorksHtml() {
    if (!chrome?.runtime?.sendMessage) {
        throw new Error('Chrome runtime messaging API is unavailable in this context.');
    }

    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    if (!response?.ok) {
        throw new Error(response?.error?.message || 'Unable to fetch latest scan status.');
    }

    const latest = response.status || {};
    const html = latest.html || latest.htmlPreview;
    if (!html) {
        throw new Error('No Degree Works HTML found. Please run "Scan Degree Works" from the popup first.');
    }

    console.log('📥 Loaded Degree Works HTML from latest scan captured at', latest.timestamp);
    return html;
}

// Fetch and load data using converter.js on Degree Works HTML
async function loadData() {
    try {
        if (!window.convertDegreeWorksHTML) {
            throw new Error('convertDegreeWorksHTML is not defined — make sure converter.js is loaded before script.js');
        }

        const html = await fetchLatestDegreeWorksHtml();
        console.log('🧮 Converting captured HTML → JSON using converter.js...');
        const data = window.convertDegreeWorksHTML(html);

        console.log('✅ Converted data summary:', {
            student: data.student,
            requirementsCount: data.requirements?.length || 0,
            completedCoursesCount: data.completedCourses?.length || 0,
            inProgressCoursesCount: data.inProgressCourses?.length || 0,
            incompleteCoursesCount: data.incompleteCourses?.length || 0
        });

        return data;
    } catch (error) {
        console.error('❌ Error converting latest scan:', error);
        try {
            console.log('⚠️ Falling back to bundled sample HTML to keep the dashboard usable.');
            const res = await fetch(SAMPLE_DEGREE_WORKS_HTML);
            if (!res.ok) throw new Error(`HTTP error fetching ${SAMPLE_DEGREE_WORKS_HTML}: ${res.status}`);
            const html = await res.text();
            return window.convertDegreeWorksHTML(html);
        } catch (fallbackError) {
            console.error('❌ Error loading fallback HTML as well:', fallbackError);
            throw error;
        }
    }
}

// Render Header
function renderHeader(student) {
    const header = document.getElementById('header');
    if (!header) {
        console.warn('#header element not found');
        return;
    }
    header.innerHTML = `
        <h1>Student Degree Audit</h1>
        <p>Academic Progress Report for ${student.name}</p>
    `;
}

// Render Student Info
function renderStudentInfo(student) {
    const studentInfo = document.getElementById('student-info');
    if (!studentInfo) {
        console.warn('#student-info element not found');
        return;
    }

    const creditsRequired = student.creditsRequired || 0;
    const creditsApplied = student.creditsApplied || 0;
    const progressPercentage = creditsRequired
        ? ((creditsApplied / creditsRequired) * 100).toFixed(1)
        : '0.0';

    studentInfo.innerHTML = `
        <h2>Student Information</h2>
        <div class="student-details">
            <div class="detail-item">
                <div class="detail-label">Name</div>
                <div class="detail-value">${student.name || ''}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Major</div>
                <div class="detail-value">${student.major || ''}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Credits Progress</div>
                <div class="detail-value">
                    ${creditsApplied} / ${creditsRequired} (${progressPercentage}%)
                </div>
            </div>
        </div>
    `;
}

// Render Requirements Overview
function renderRequirementsOverview(requirements) {
    const requirementsSection = document.getElementById('requirements-overview');
    if (!requirementsSection) {
        console.warn('#requirements-overview element not found');
        return;
    }

    if (!requirements || requirements.length === 0) {
        requirementsSection.style.display = 'none';
        return;
    }

    const requirementsHTML = requirements.map(req => {
        const statusClass = req.status.toLowerCase().replace(/[^a-z]/g, '-');
        return `
            <div class="requirement-card">
                <div class="requirement-header">
                    <div class="requirement-id">
                        ${(() => {
                            const words = req.id
                                .toLowerCase()
                                .replace(/_/g, " ")
                                .split(" ");
                            const smallWords = ["of", "in", "and", "on", "for", "to"];
                            return words
                                .map((w, i) =>
                                    i === 0 || !smallWords.includes(w)
                                        ? w.charAt(0).toUpperCase() + w.slice(1)
                                        : w
                                )
                                .join(" ");
                        })()}
                    </div>
                    <div class="status-badge status-${statusClass}">${req.status}</div>
                </div>
                <div class="requirement-details">
                    ${req.creditsRequired ? `
                        <div class="requirement-detail">
                            <span class="requirement-detail-label">Credits Required:</span>
                            <span>${req.creditsRequired}</span>
                        </div>
                    ` : ''}
                    ${req.creditsApplied ? `
                        <div class="requirement-detail">
                            <span class="requirement-detail-label">Credits Applied:</span>
                            <span>${req.creditsApplied}</span>
                        </div>
                    ` : ''}
                    <div class="requirement-detail">
                        <span class="requirement-detail-label">Catalog Year:</span>
                        <span>${req.catalogYear}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    requirementsSection.innerHTML = `
        <h2>Degree Requirements</h2>
        <div class="requirements-grid">
            ${requirementsHTML}
        </div>
    `;
    requirementsSection.style.display = 'block';
}

// Render Unmet Conditions
function renderUnmetConditions(conditions) {
    const conditionsSection = document.getElementById('unmet-conditions');

    if (!conditionsSection) {
        console.warn('#unmet-conditions element not found');
        return;
    }

    if (!conditions || conditions.length === 0) {
        conditionsSection.style.display = 'none';
        return;
    }

    const conditionsHTML = conditions.map(condition => `
        <div class="condition-card">
            <div class="condition-icon">⚠️</div>
            <div class="condition-content">
                <div class="condition-description">${condition.description}</div>
                ${condition.creditsNeeded ? `
                    <div class="credits-needed">Credits Needed: <strong>${condition.creditsNeeded}</strong></div>
                ` : ''}
                ${condition.note ? `
                    <div class="condition-note">${condition.note}</div>
                ` : ''}
            </div>
        </div>
    `).join('');

    conditionsSection.innerHTML = `
        <h2>Unmet Conditions</h2>
        <div class="conditions-list">
            ${conditionsHTML}
        </div>
    `;
    conditionsSection.style.display = 'block';
}

// Grade class helper
function getGradeClass(grade) {
    if (!grade) return 'grade-default';

    const g = grade.toUpperCase();
    if (g === 'S' || g === 'T' || g === 'P') return 'grade-special';
    const first = g.charAt(0);
    if (first === 'A') return 'grade-a';
    if (first === 'B') return 'grade-b';
    if (first === 'C') return 'grade-c';
    if (first === 'D') return 'grade-d';
    if (first === 'F') return 'grade-f';
    return 'grade-default';
}

// ================================
// Requirement → course filter helpers
// ================================

// Return all courses (completed + in-progress + incomplete)
function getAllCoursesFromData(data) {
    if (!data) return [];
    return [
        ...(data.completedCourses || []),
        ...(data.inProgressCourses || []),
        ...(data.incompleteCourses || []),
    ];
}


// When user clicks an *incomplete requirement* card with no code
function handleIncompleteRequirementClick(course) {
    if (!course) return;

    const title = course.title || course.description || 'Requirement';
    const matches = filterCoursesForRequirementTitle(title);

    const payload = {
        requirementTitle: title,
        matches,
    };

    try {
        localStorage.setItem('selectedRequirement', JSON.stringify(payload));
    } catch (e) {
        console.warn('Could not store selectedRequirement in localStorage:', e);
    }

    // Navigate in the same tab to the detail page
    window.location.href = 'requirement-detail.html';
}

/* ================================
   Requirement → course filter
   ================================ */

// Grab all courses from DEGREE_AUDIT_DATA
function getAllCourses() {
    if (!DEGREE_AUDIT_DATA) return [];
    return [
        ...(DEGREE_AUDIT_DATA.completedCourses || []),
        ...(DEGREE_AUDIT_DATA.inProgressCourses || []),
        ...(DEGREE_AUDIT_DATA.incompleteCourses || []),
    ];
}

// Given a requirement title/description, find matching sections
// in SCHEDULE_DATA (Spring 2026 schedule JSON).
function filterCoursesForRequirementTitle(title) {
    if (!Array.isArray(SCHEDULE_DATA) || SCHEDULE_DATA.length === 0) return [];

    const upper = (title || '').toUpperCase().trim();
    if (!upper) return [];

    const tokens = upper.split(/\s+/);

    // ==============================
    // 1) SBC requirement, e.g. "1 Class in ESI" / "1 Class in WRTD"
    //    We only treat it as SBC if the word after "IN" is NOT followed
    //    by a course number (otherwise it's "ACC 210", not an SBC code).
    // ==============================
    let sbcCode = null;

    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === 'IN' && i + 1 < tokens.length) {
            const candidate = tokens[i + 1];      // ESI, WRTD, ACC, ...
            const after = tokens[i + 2];          // maybe 210, 311, etc.

            const looksLikeCode = /^[A-Z]{3,4}$/.test(candidate);
            const looksLikeCourseNumber = after && /^\d{3}[A-Z]?$/.test(after);

            // If it's 3–4 letters and NOT followed by a number → treat as SBC
            if (looksLikeCode && !looksLikeCourseNumber) {
                sbcCode = candidate;
                break;
            }
        }
    }

    if (sbcCode) {
        return SCHEDULE_DATA.filter(sec =>
            typeof sec.SBC === 'string' &&
            sec.SBC.toUpperCase().includes(sbcCode)
        );
    }

        // ==============================
    // 1.5) Level requirement, e.g.
    // "15 to 17 Credits in @ 300:499 or 500:599"
    // → include any course with number in 300–599
    // ==============================
    if (/@\s*300:499/.test(upper) || /@\s*500:599/.test(upper)) {
        return SCHEDULE_DATA.filter(sec => {
            const num = parseInt(sec.Course, 10);
            if (Number.isNaN(num)) return false;
            return num >= 300 && num < 600; // 300–599
        });
    }
    
    // ===============================================
    // 2) Long course list with shared departments, e.g.
    //    "2 Classes in AMS 335 or ECO 310 or 316 ..." etc.
    // ===============================================
    const wanted = new Set();
    let currentDept = null;

    function isDept(tok) {
        // Valid departments like ACC, AMS, ECO, CSE, MAT, etc.
        // Explicitly exclude words that are part of the sentence.
        return (
            /^[A-Z]{2,4}$/.test(tok) &&
            tok !== 'OR' &&
            tok !== 'IN' &&
            tok !== 'CLASS' &&
            tok !== 'CLASSES'
        );
    }

    function isNum(tok) {
        // 210, 311, 359, 359H etc.
        return /^\d{3}[A-Z]?$/.test(tok);
    }

    function addPair(dept, num) {
        if (!dept || !num) return;
        wanted.add(dept + ' ' + num);
    }

    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];

        // Handle "OR ..." first so "OR" is never mis-read as a dept
        if (tok === 'OR') {
            // "or AMS 261" → new dept
            if (i + 2 < tokens.length && isDept(tokens[i + 1]) && isNum(tokens[i + 2])) {
                currentDept = tokens[i + 1];
                addPair(currentDept, tokens[i + 2]);
                i += 2;
                continue;
            }
            // "or 311" → same dept as before
            if (i + 1 < tokens.length && isNum(tokens[i + 1]) && currentDept) {
                addPair(currentDept, tokens[i + 1]);
                i += 1;
                continue;
            }
        }

        // Start of a block: "ACC 210" / "AMS 335"
        if (isDept(tok) && i + 1 < tokens.length && isNum(tokens[i + 1])) {
            currentDept = tok;
            addPair(currentDept, tokens[i + 1]);
            i += 1;
            continue;
        }
    }

    if (wanted.size === 0) return [];

    // Match Dept + Course from schedule JSON
    return SCHEDULE_DATA.filter(sec => {
        const dept = (sec.Dept || '').toUpperCase();
        const courseStr = String(sec.Course); // numeric → string
        const key = dept + ' ' + courseStr;
        return wanted.has(key);
    });
}


function ensureRequirementResultsSection() {
    let section = document.getElementById('requirement-results');
    if (!section) {
        section = document.createElement('section');
        section.id = 'requirement-results';
        section.style.marginTop = '2rem';
        const app = document.getElementById('app') || document.body;
        app.appendChild(section);
    }
    return section;
}

// Render Courses
function renderCourses(courses, sectionId, title, showGrade = true) {
    const section = document.getElementById(sectionId);

    if (!section) {
        console.warn(`#${sectionId} element not found`);
        return;
    }

    if (!courses || courses.length === 0) {
        section.style.display = 'none';
        return;
    }

    console.log(`🎓 Rendering ${title}:`, courses.length, 'courses');

    const coursesHTML = courses.map((course, index) => `
        <div class="course-card" style="animation-delay: ${index * 0.05}s">
            <div class="course-header">
                <div class="course-code">${course.code}</div>
                <div class="course-name">${course.title}</div>
            </div>
            <div class="course-details">
                <div class="course-detail">
                    <span class="course-detail-label">Credits:</span>
                    <span>${course.credits}</span>
                </div>
                ${course.term ? `
                    <div class="course-detail">
                        <span class="course-detail-label">Term:</span>
                        <span>${course.term}</span>
                    </div>
                ` : ''}
                ${course.sbcCategory ? `
                    <div class="course-detail">
                        <span class="course-detail-label">Category:</span>
                        <span class="sbc-category">${course.sbcCategory}</span>
                    </div>
                ` : ''}
                ${showGrade && course.grade ? `
                    <div class="course-detail">
                        <span class="course-detail-label">Grade:</span>
                        <span class="grade ${getGradeClass(course.grade)}">${course.grade}</span>
                    </div>
                ` : ''}
                ${course.note ? `
                    <div class="course-note">${course.note}</div>
                ` : ''}
            </div>
        </div>
    `).join('');

    section.innerHTML = `
        <h2>${title} (${courses.length})</h2>
        <div class="courses-grid">
            ${coursesHTML}
        </div>
    `;
    section.style.display = 'block';

    // 🔗 Make incomplete requirement cards clickable ONLY when they have no "code"
    if (sectionId === 'incomplete-courses') {
        const cards = section.querySelectorAll('.course-card');
        cards.forEach((card, index) => {
            const course = courses[index];
            const hasCode = !!(course && course.code && String(course.code).trim());
            if (!hasCode) {
                card.classList.add('requirement-clickable');
                card.addEventListener('click', () => handleIncompleteRequirementClick(course));
            }
        });
    }
}

// Initialize App
async function init() {
    console.log('🚀 init() starting...');

    // Load Spring 2026 schedule so recommendations work
    await loadSchedule();

    let data;
    try {
        data = await loadData();
    } catch (error) {
        renderFatalError(error?.message || 'Could not load data. Check console for details.');
        return;
    }

    // Store globally for other helpers
    DEGREE_AUDIT_DATA = data;

    console.log('📊 Rendering with data:', data);
    renderHeader(data.student);
    renderStudentInfo(data.student);
    renderRequirementsOverview(data.requirements);
    renderUnmetConditions(data.unmetConditions);
    renderCourses(data.completedCourses, 'completed-courses', 'Completed Courses', true);
    renderCourses(data.inProgressCourses, 'in-progress-courses', 'In Progress Courses', false);
    renderCourses(data.incompleteCourses, 'incomplete-courses', 'Incomplete Requirements', false);

    console.log('✅ Page loaded and rendered successfully!');
}

document.addEventListener('DOMContentLoaded', init);

function renderFatalError(message) {
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = `
        <div style="color: white; text-align: center; padding: 2rem;">
            <h1>Error Loading Data</h1>
            <p>${message}</p>
        </div>
    `;
}

