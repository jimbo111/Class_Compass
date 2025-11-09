(() => {
  const prefs = {
    format: 'json',
    includeMetadata: true,
    fileNameTemplate: '{title} - {yyyy-mm-dd HHmmss}'
  };
  
  runScan();
  
  function runScan() {
    try {
      const content = extractPageContent(prefs);
      content.analysis = analyzeDegreeWorks();
      chrome.runtime.sendMessage({ type: 'SCAN_SUCCESS', data: content });
    } catch (error) {
      chrome.runtime.sendMessage({
        type: 'SCAN_ERROR',
        error: { message: error?.message || 'Failed to scan page' }
      });
    }
  }
  
  function extractPageContent(prefs) {
    const content = {
      title: document.title || 'Untitled',
      url: window.location.href,
      text: document.body?.innerText || '',
      html: getPageHtml(),
      timestamp: new Date().toISOString()
    };
    
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      content.hasSelection = true;
      content.selectedText = selection.toString();
    }
    
    return content;
  }
  
  function getPageHtml() {
    return (
      document.documentElement?.outerHTML ||
      document.body?.innerHTML ||
      ''
    );
  }
  
  function analyzeDegreeWorks() {
    const textNodes = document.querySelectorAll('tr, li, p, div');
    const courseRegex = /\b[A-Z]{2,4}\s?[A-Z]?\d{3}[A-Z]?\b/g;
    const coursesMap = new Map();
    
    textNodes.forEach((node) => {
      const text = node.innerText?.trim();
      if (!text) return;
      const matches = text.match(courseRegex);
      if (!matches) return;
      
      const status = inferStatus(text);
      matches.forEach((rawCourse) => {
        const course = rawCourse.replace(/\s+/g, ' ').toUpperCase();
        const current = coursesMap.get(course) || { course, status: 'planned', details: '' };
        current.details = text.slice(0, 280);
        current.status = prioritizeStatus(current.status, status);
        coursesMap.set(course, current);
      });
    });
    
    const courses = Array.from(coursesMap.values());
    const totals = {
      totalCourses: courses.length,
      completed: courses.filter((c) => c.status === 'completed').length,
      inProgress: courses.filter((c) => c.status === 'in-progress').length,
      planned: courses.filter((c) => c.status === 'planned').length,
    };
    
    const requirements = extractRequirements();
    
    return {
      generatedAt: new Date().toISOString(),
      totals,
      courses,
      requirements,
    };
  }
  
  function inferStatus(text) {
    if (/complete|fulfilled|satisfied/i.test(text)) return 'completed';
    if (/in progress|ip\s|registered|currently taking/i.test(text)) return 'in-progress';
    return 'planned';
  }
  
  function prioritizeStatus(existing, incoming) {
    const order = { 'planned': 0, 'in-progress': 1, 'completed': 2 };
    return order[incoming] > order[existing] ? incoming : existing;
  }
  
  function extractRequirements() {
    const headings = document.querySelectorAll('h2, h3, h4, .requirementHeader, .blockheader');
    return Array.from(headings).map((heading) => {
      const title = heading.innerText?.trim();
      if (!title) return null;
      const block = heading.closest('.requirement, .block, section') || heading.parentElement;
      const statusText = block?.innerText || '';
      return {
        title,
        status: /complete|fulfilled/i.test(statusText) ? 'completed' : (/in progress/i.test(statusText) ? 'in-progress' : 'planned'),
        detail: statusText.slice(0, 320),
      };
    }).filter(Boolean);
  }
  
  function formatContent(content, prefs) {
    switch (prefs.format) {
      case 'markdown':
        return formatAsMarkdown(content, prefs);
      case 'html':
        return formatAsHTML(content, prefs);
      case 'json':
        return JSON.stringify(content, null, 2);
      case 'text':
      default:
        return formatAsText(content, prefs);
    }
  }
  
  function formatAsMarkdown(content, prefs) {
    let markdown = '';
    
    if (prefs.includeMetadata) {
      markdown += `---
`;
      markdown += `title: ${content.title}
`;
      markdown += `url: ${content.url}
`;
      markdown += `date: ${content.timestamp}
`;
      markdown += `---

`;
    }
    
    markdown += `# ${content.title}

`;
    
    if (content.hasSelection) {
      markdown += content.selectedText;
    } else {
      markdown += content.text;
    }
    
    return markdown;
  }
  
  function formatAsHTML(content, prefs) {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
`;
    html += `  <meta charset="UTF-8">
`;
    html += `  <title>${content.title}</title>
`;
    
    if (prefs.includeMetadata) {
      html += `  <meta name="source-url" content="${content.url}">
`;
      html += `  <meta name="saved-date" content="${content.timestamp}">
`;
    }
    
    html += `</head>
<body>
`;
    
    if (prefs.includeMetadata) {
      html += `  <header>
`;
      html += `    <h1>${content.title}</h1>
`;
      html += `    <p>Source: <a href="${content.url}">${content.url}</a></p>
`;
      html += `    <p>Saved: ${new Date(content.timestamp).toLocaleString()}</p>
`;
      html += `  </header>
  <hr>
`;
    }
    
    if (content.hasSelection) {
      html += `  <div>${content.selectedText}</div>
`;
    } else {
      html += content.html;
    }
    
    html += `</body>
</html>`;
    
    return html;
  }
  
  function formatAsText(content, prefs) {
    let text = '';
    
    if (prefs.includeMetadata) {
      text += `Title: ${content.title}
`;
      text += `URL: ${content.url}
`;
      text += `Saved: ${new Date(content.timestamp).toLocaleString()}
`;
      text += `${'='.repeat(60)}

`;
    }
    
    if (content.hasSelection) {
      text += content.selectedText;
    } else {
      text += content.text;
    }
    
    return text;
  }
  
  function generateFileName(title, prefs) {
    const template = prefs.fileNameTemplate || '{title} - {yyyy-mm-dd HHmmss}';
    const date = new Date();
    
    const sanitizedTitle = title
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50);
    
    const replacements = {
      '{title}': sanitizedTitle,
      '{yyyy}': date.getFullYear(),
      '{mm}': String(date.getMonth() + 1).padStart(2, '0'),
      '{dd}': String(date.getDate()).padStart(2, '0'),
      '{HH}': String(date.getHours()).padStart(2, '0'),
      '{MM}': String(date.getMinutes()).padStart(2, '0'),
      '{ss}': String(date.getSeconds()).padStart(2, '0'),
      '{yyyy-mm-dd}': `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      '{HHmmss}': `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`
    };
    
    let filename = template;
    for (const [key, value] of Object.entries(replacements)) {
      filename = filename.replace(new RegExp(key, 'g'), value);
    }
    
    const extensions = {
      'markdown': '.md',
      'html': '.html',
      'json': '.json',
      'text': '.txt'
    };
    
    filename += extensions[prefs.format] || '.txt';
    
    return filename;
  }
  
  function getMimeType(format) {
    const types = {
      'markdown': 'text/markdown',
      'html': 'text/html',
      'json': 'application/json',
      'text': 'text/plain'
    };
    
    return types[format] || 'text/plain';
  }
})();
