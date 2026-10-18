#!/usr/bin/env node
/**
 * Regenerate Objectiv investor PDFs with Puppeteer header/footer letterhead
 * (avoids fixed-position overlap that clips table rows at page breaks).
 */
const { execFileSync } = require('child_process');
const { readFileSync, writeFileSync, unlinkSync } = require('fs');
const path = require('path');

const docsDir = __dirname;
const logoB64 = readFileSync(
  path.join(docsDir, 'assets/azing-logo.png'),
).toString('base64');

function headerTemplate(docLinesHtml) {
  return (
    '<div style="width:100%;font-size:8px;font-family:Helvetica,Arial,sans-serif;' +
    'padding:0 0 5px;box-sizing:border-box;border-bottom:0.6px solid #000;' +
    'display:flex;align-items:center;justify-content:space-between;-webkit-print-color-adjust:exact;">' +
    '<div style="display:flex;align-items:center;gap:6px;">' +
    `<img src="data:image/png;base64,${logoB64}" style="height:28px;width:auto;" />` +
    '<div><div style="font-size:11px;font-weight:bold;line-height:1.2;">A-Zing Innovations</div>' +
    '<div style="font-size:7px;color:#333;line-height:1.2;">Make the right move.</div></div></div>' +
    `<div style="text-align:right;font-size:7px;line-height:1.35;max-width:48%;">${docLinesHtml}</div>` +
    '</div>'
  );
}

const footerTemplate =
  '<div style="width:100%;font-size:7px;font-family:Helvetica,Arial,sans-serif;' +
  'padding:4px 0 0;box-sizing:border-box;border-top:0.6px solid #000;' +
  'display:flex;justify-content:space-between;color:#222;-webkit-print-color-adjust:exact;">' +
  '<span>www.a-zing.org</span>' +
  '<span>Confidential — not for redistribution without permission</span></div>';

function pdfOptions(docLinesHtml) {
  return {
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: headerTemplate(docLinesHtml),
    footerTemplate,
    margin: {
      top: '30mm',
      bottom: '16mm',
      left: '18mm',
      right: '18mm',
    },
  };
}

function build(mdFile, stylesheet, dest, docLinesHtml) {
  const configPath = path.join(docsDir, `.md-to-pdf-${dest}.json`);
  writeFileSync(
    configPath,
    JSON.stringify({
      stylesheet: path.join(docsDir, stylesheet),
      pdf_options: pdfOptions(docLinesHtml),
      dest: path.join(docsDir, dest),
    }),
  );
  try {
    execFileSync(
      'npx',
      ['--yes', 'md-to-pdf', path.join(docsDir, mdFile), '--config-file', configPath],
      { cwd: docsDir, stdio: 'inherit' },
    );
  } finally {
    unlinkSync(configPath);
  }
}

build(
  'OBJECTIV_INVESTMENT_PLAN.md',
  'budget-pdf.css',
  'OBJECTIV_INVESTMENT_PLAN.pdf',
  'Objectiv · Investment plan<br/>A-Zing Innovations · Confidential · INR',
);

build(
  'OBJECTIV_PITCH_DECK.md',
  'pitch-deck-pdf.css',
  'OBJECTIV_PITCH_DECK.pdf',
  'Objectiv · Investor brief<br/>Launch month 4 · Confidential · INR',
);

console.log('Done: OBJECTIV_INVESTMENT_PLAN.pdf, OBJECTIV_PITCH_DECK.pdf');
