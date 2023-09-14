const jimp = require("jimp");

async function compareImageSimilarity(
  libraryImagePath,
  importImagePath,
  distanceThreshold = 0.15, // The hamming distance threshold (0.15, 15% is a good default value)
  differenceThreshold = 0.15, // The pixel difference threshold (0.15, 15% is a good default value)
  flattenColorChannels = true // If true, the images will be converted to grayscale before comparing, useful for comparing images with different color channels
) {
  const image_1 = await jimp.read(libraryImagePath);
  const image_2 = await jimp.read(importImagePath);

  // preprocess the images to increase the accuracy of the comparison
  let image_1_preprocessed = image_1.clone();
  let image_2_preprocessed = image_2.clone();
  // If flattenColorChannels is true, convert the images to grayscale
  if (flattenColorChannels) {
    image_1_preprocessed = image_1_preprocessed.grayscale();
    image_2_preprocessed = image_2_preprocessed.grayscale();
  }

  // Compare the hashes (hamming distance)
  const raw_distance = jimp.distance(image_1, image_2);
  const distance = jimp.distance(image_1_preprocessed, image_2_preprocessed);

  // Compare the images (pixel difference)
  const raw_difference = jimp.diff(image_1, image_2);
  const difference = jimp.diff(image_1_preprocessed, image_2_preprocessed);

  console.log("Distance: ", distance);
  console.log("Difference: ", difference.percent);
  console.log(
    "Compare",
    distance < distanceThreshold,
    difference.percent < differenceThreshold,
    distance < distanceThreshold || difference.percent < differenceThreshold
  );

  // If the hamming distance is 0 or the pixel difference is 0, the images are identical
  if (raw_distance === 0 || raw_difference.percent === 0) {
    return 0;
  }
  // If the hamming distance is less than distanceThreshold and the pixel difference is less than differenceThreshold, the images are similar
  if (
    distance < distanceThreshold ||
    difference.percent < differenceThreshold
  ) {
    return 1;
  }
  return -1;
}

module.exports = { compareImageSimilarity };
