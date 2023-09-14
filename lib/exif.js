const ExifTool = require("exiftool-vendored").ExifTool;

async function parseImageTags(src) {
  const exiftool = new ExifTool({ taskTimeoutMillis: 5000 });
  const { Keywords, Subject } = await exiftool.read(src);
  let tags = [];
  if (Keywords?.length > 0) {
    tags = Keywords;
  } else if (Subject?.length > 0) {
    tags = Subject;
  }
  return tags;
}

module.exports = { parseImageTags };
