const path = require('path');
const fs = require('fs');
const { fromPath } = require('pdf2pic');

const pdfPath = path.join(__dirname, '../data/Purification_of_the _mind_Qadir.pdf');
const outputDir = path.join(__dirname, '../output');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

async function convertPageToImage(pageNo) {
  const options = {
    density: 100,
    saveFilename: `page-${pageNo}`,
    savePath: outputDir,
    format: 'jpeg',
    width: 1024,
    height: 1024
  };

  const convert = fromPath(pdfPath, options);

  try {
    const result = await convert(pageNo);
    console.log(`✅ Converted page ${pageNo}: ${result.path}`);
    return result.path;
  } catch (err) {
    throw new Error(`Failed to convert PDF page: ${err.message}`);
  }
}

module.exports = { convertPageToImage };
