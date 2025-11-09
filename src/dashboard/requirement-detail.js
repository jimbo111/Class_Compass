document.addEventListener('DOMContentLoaded', () => {
    const titleEl = document.getElementById('detail-title');
    const section = document.getElementById('detail-courses');
    const backBtn = document.getElementById('back-button');

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            // Go back to main degree audit page in the same tab
            window.location.href = 'index.html';
        });
    }

    let payload = null;
    try {
        const raw = localStorage.getItem('selectedRequirement');
        if (raw) {
            payload = JSON.parse(raw);
        }
    } catch (e) {
        console.error('Error reading selectedRequirement from localStorage:', e);
    }

    if (!payload) {
        if (titleEl) {
            titleEl.textContent = 'Requirement Detail';
        }
        if (section) {
            section.innerHTML = `
                <p class="no-results">
                    No requirement information was found. Try clicking a requirement again from the main page.
                </p>
            `;
        }
        return;
    }

    const { requirementTitle, matches } = payload;

    if (titleEl) {
        titleEl.textContent = requirementTitle || 'Requirement Detail';
    }

    if (!section) return;

    if (!matches || matches.length === 0) {
        section.innerHTML = `
            <h2>Courses that can satisfy this requirement (0)</h2>
            <p class="no-results">
                No matching courses found for this requirement in your audit data.
            </p>
        `;
        return;
    }

    const coursesHTML = matches.map((course, index) => {
        // Normalize fields for BOTH:
        //  - degree audit courses (code, title, credits, sbcCategory, term)
        //  - schedule entries (Dept, Course, Title, Credits, SBC, Days, Time, Instructor)
        const code =
            course.code ||
            (course.Dept && course.Course ? `${course.Dept} ${course.Course}` : '');

        const title = course.title || course.Title || '';

        const credits =
            course.credits ??
            course.Credits ??
            '';

        const sbc =
            course.sbcCategory ||
            course.SBC ||
            '';

        // Time: use degree-audit term if present, otherwise schedule Days + Time
        const time =
            course.term ||
            (course.Days && course.Time ? `${course.Days} ${course.Time}` : '');

        const professor = course.Instructor || '';

        return `
            <div class="course-card" style="animation-delay:${index * 0.05}s">
                <div class="course-header">
                    <div class="course-code">${code}</div>
                    <div class="course-name">${title}</div>
                </div>
                <div class="course-details">
                    <div class="course-detail">
                        <span class="course-detail-label">Credits:</span>
                        <span>${credits}</span>
                    </div>
                    ${sbc ? `
                        <div class="course-detail">
                            <span class="course-detail-label">SBC:</span>
                            <span class="sbc-category">${sbc}</span>
                        </div>` : ''}
                    ${time ? `
                        <div class="course-detail">
                            <span class="course-detail-label">Time:</span>
                            <span>${time}</span>
                        </div>` : ''}
                    ${professor ? `
                        <div class="course-detail">
                            <span class="course-detail-label">Professor:</span>
                            <span>${professor}</span>
                        </div>` : ''}
                </div>
            </div>
        `;
    }).join('');



    section.innerHTML = `
        <h2>Courses that can satisfy this requirement (${matches.length})</h2>
        <div class="courses-grid">
            ${coursesHTML}
        </div>
    `;
});
