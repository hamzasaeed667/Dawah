const path = require('path');
const fs = require('fs');
const convert = require('pdf-poppler');

const pdfPath = path.join(__dirname, '../data/Purification_of_the_mind_Qadir_al-Jilani.pdf');
const outputDir = path.join(__dirname, '../output');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

async function convertPageToImage(pageNo) {
  const options = {
    format: 'jpeg',
    out_dir: outputDir,
    out_prefix: `page-${pageNo}`,
    page: pageNo
  };

  try {
    await convert.convert(pdfPath, options);
    const imagePath = path.join(outputDir, `page-${pageNo}-1.jpg`); // poppler appends "-1"
    return imagePath;
  } catch (err) {
    throw new Error(`Failed to convert PDF page: ${err.message}`);
  }
}

module.exports = { convertPageToImage };
