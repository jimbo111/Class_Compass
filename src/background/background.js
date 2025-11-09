console.log('Page Saver background script loaded');

const DEFAULT_STATUS = {
  status: 'Waiting for scan…',
  html: '',
  htmlPreview: '',
  sourceTitle: '',
  sourceUrl: '',
  diagnostics: '',
  analysis: null,
  timestamp: null,
};

let latestStatus = { ...DEFAULT_STATUS };
initStatusCache();

// Initialize on installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Page Saver installed');
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request.type);
  
  // Handle message based on type
  switch(request.type) {
    case 'GET_PAGE_INFO':
      handleGetPageInfo().then(sendResponse);
      return true;
      
    case 'SCAN_PAGE':
      handleScanPage(sendResponse);
      return true;
      
    case 'SCAN_SUCCESS':
      handleScanSuccess(request.data).then(sendResponse);
      return true;
      
    case 'SCAN_ERROR':
      handleScanError(request.error).then(sendResponse);
      return true;
      
    case 'GET_STATUS':
      handleGetStatus(sendResponse);
      return true;
      
    default:
      sendResponse({ ok: false, error: { message: 'Unknown message type' } });
      return false;
  }
});

// Get current page info
async function handleGetPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    const url = new URL(tab.url);
    
    return {
      ok: true,
      info: {
        title: tab.title || 'Untitled',
        url: tab.url,
        host: url.hostname,
        faviconUrl: tab.favIconUrl || ''
      }
    };
  } catch (error) {
    console.error('Error getting page info:', error);
    return { 
      ok: false, 
      error: { message: error.message },
      info: { title: 'Error', url: '', host: '', faviconUrl: '' }
    };
  }
}

// Scan the current page
async function handleScanPage(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    // Inject content script to extract content
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content/content.js']
    });

    sendResponse({ ok: true });
    
  } catch (error) {
    console.error('Error scanning:', error);
    sendResponse({ ok: false, error: { message: error.message } });
  }
}

async function handleScanSuccess(data) {
  try {
    const statusPayload = buildStatusPayload(data);
    await broadcastStatus(statusPayload);
    
    return { ok: true };
  } catch (error) {
    console.error('Error handling scan success:', error);
    const fallbackStatus = `Status unavailable: ${error.message}`;
    await broadcastStatus({ status: fallbackStatus, diagnostics: error.message });
    return { ok: false, error: { message: error.message } };
  }
}

async function handleScanError(error) {
  const message = error?.message || 'Failed to scan page';
  console.error('Scan error reported from content script:', message);
  const status = `Scan failed: ${message}`;
  await broadcastStatus({ status, diagnostics: message });
  return { ok: false, error: { message } };
}

async function broadcastStatus({ status, html = '', htmlPreview = '', sourceTitle = '', sourceUrl = '', diagnostics = '', analysis = null, timestamp = new Date().toISOString() }) {
  const htmlPayload = html || htmlPreview || '';
  latestStatus = {
    status: status || 'Scan complete',
    html: htmlPayload,
    htmlPreview: htmlPayload,
    sourceTitle,
    sourceUrl,
    diagnostics,
    analysis,
    timestamp
  };
  
  await chrome.storage.local.set({ latestStatus });
  
  try {
    await chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', payload: latestStatus });
  } catch (error) {
    console.warn('Status broadcast listeners unavailable:', error.message);
  }
}

function handleGetStatus(sendResponse) {
  sendResponse({ ok: true, status: latestStatus });
}

function buildStatusPayload(data) {
  const analysis = data?.analysis || buildFallbackAnalysis(data?.html);
  const summary = summarizeAnalysis(analysis);
  
  return {
    status: summary,
    html: data?.html,
    htmlPreview: data?.html,
    sourceTitle: data?.title,
    sourceUrl: data?.url,
    diagnostics: analysis ? '' : 'Analysis could not be generated.',
    analysis,
    timestamp: new Date().toISOString()
  };
}

function summarizeAnalysis(analysis) {
  if (!analysis?.totals) {
    return 'Scan complete';
  }
  
  const { completed, totalCourses, inProgress } = analysis.totals;
  if (totalCourses === 0) {
    return 'Scan complete (no courses detected)';
  }
  return `Completed ${completed}/${totalCourses} courses (${inProgress} in progress)`;
}

function buildFallbackAnalysis(html) {
  if (!html) return null;
  
  return {
    generatedAt: new Date().toISOString(),
    totals: { totalCourses: 0, completed: 0, inProgress: 0, planned: 0 },
    courses: [],
    requirements: [],
    notes: 'HTML captured but analysis was unavailable.'
  };
}

async function initStatusCache() {
  try {
    const stored = await chrome.storage.local.get('latestStatus');
    if (stored?.latestStatus) {
      latestStatus = stored.latestStatus;
    }
  } catch (error) {
    console.warn('Failed to restore cached status:', error.message);
    latestStatus = { ...DEFAULT_STATUS };
  }
}

// Helper: Check if URL is restricted
function isRestrictedUrl(url) {
  const patterns = [
    /^chrome:\/\//,
    /^chrome-extension:\/\//,
    /^https:\/\/chrome\.google\.com\/webstore/,
    /^edge:\/\//,
    /^about:/
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

console.log('Background script initialized');
