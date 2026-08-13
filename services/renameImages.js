const fs = require('fs');
const path = require('path');

/**
 * Rename images in a folder:
 *  - Removes a specific prefix
 *  - Strips leading zeros from the numeric part of the filename
 *
 * @param {string} folderPath - Absolute path to the image directory.
 * @param {string} prefixToRemove - The exact string prefix to remove from each filename.
 */
function renameImages(folderPath, prefixToRemove) {
  fs.readdir(folderPath, (err, files) => {
    if (err) {
      console.error('Error reading folder:', err);
      return;
    }

    files.forEach((file) => {
      const fullPath = path.join(folderPath, file);

      // Skip non-matching files
      if (!file.startsWith(prefixToRemove)) return;

      // Remove the prefix
      const nameWithoutPrefix = file.replace(prefixToRemove, '');

      // Extract number and extension
      const match = nameWithoutPrefix.match(/^0*(\d+)(\.\w+)$/);
      if (!match) {
        console.warn(`Skipping invalid file: ${file}`);
        return;
      }

      const numberPart = match[1]; // e.g., '26'
      const extension = match[2];  // e.g., '.jpg'
      const newName = `${numberPart}${extension}`;

      const newFullPath = path.join(folderPath, newName);

      fs.rename(fullPath, newFullPath, (err) => {
        if (err) {
          console.error(`Error renaming file ${file}:`, err);
        } else {
          console.log(`Renamed: ${file} → ${newName}`);
        }
      });
    });
  });
}

module.exports = { renameImages };
