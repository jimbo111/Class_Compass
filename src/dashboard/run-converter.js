const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Provide DOMParser globally for converter.js
const { window } = new JSDOM('<!DOCTYPE html><p>stub</p>');
global.DOMParser = window.DOMParser;

global.Node = window.Node;

global.document = window.document;

const converter = require('./converter');

const htmlPath = path.join(__dirname, 'degree-works-et.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const json = converter.convertDegreeWorksHTML(html);

const outPath = path.join(__dirname, 'converted-data.json');
fs.writeFileSync(outPath, JSON.stringify(json, null, 2), 'utf8');

console.log(`Converted data written to ${outPath}`);
console.log(`Student: ${json.student.name}`);
console.log(`Requirements: ${json.requirements.length}`);
console.log(`Completed courses: ${json.completedCourses.length}`);
console.log(`In-progress courses: ${json.inProgressCourses.length}`);
