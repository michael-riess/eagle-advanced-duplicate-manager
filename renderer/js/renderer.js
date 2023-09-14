const form = document.querySelector("#form");
const submitButton = document.querySelector("#submit-button");
const img = document.querySelector("#img");
const importPath = document.querySelector("#import-path");
const libraryPath = document.querySelector("#library-path");
const heightInput = document.querySelector("#height");
const widthInput = document.querySelector("#width");
const dir = document.querySelector("#dir");
const lib = document.querySelector("#lib");
const dirLabel = document.querySelector("#dir-label");
const libLabel = document.querySelector("#lib-label");
const compareImages = document.querySelector("#compare-images");
const imageCompare_1 = document.querySelector("#image-1");
const imageCompare_2 = document.querySelector("#image-2");

var importDir = null;
var library = null;

ipcRenderer.on("images:resolve-collision", (data) => {
  console.log("Resolve Collision: ", JSON.parse(data));
  const compareData = JSON.parse(data);
  imageCompare_1.src = compareData.existingImage.src;
  imageCompare_2.src = compareData.newImage.src;
  compareImages.style.display = "flex";

  const keepExistingButton = document.querySelector("#keep-existing-button");
  const keepBothButton = document.querySelector("#keep-both-button");
  const replaceButton = document.querySelector("#replace-button");

  keepExistingButton.addEventListener("click", () => {
    compareImages.style.display = "none";
    ipcRenderer.send("callback", {
      key: "images:resolve-collision-response",
      value: "KEEP_EXISTING",
    });
  });
  keepBothButton.addEventListener("click", () => {
    ipcRenderer.send("callback", {
      key: "images:resolve-collision-response",
      value: "KEEP_BOTH",
    });
  });
  replaceButton.addEventListener("click", () => {
    ipcRenderer.send("callback", {
      key: "images:resolve-collision-response",
      value: "REPLACE_WITH_NEW",
    });
  });
});

// Make sure file is an image
function isFileImage(file) {
  const acceptedImageTypes = ["image/gif", "image/jpeg", "image/png"];
  return file && acceptedImageTypes.includes(file["type"]);
}

// Resize image
function resizeImage(e) {
  console.log("Resize image");
  e.preventDefault();

  if (!img.files[0]) {
    alertError("Please upload an image");
    return;
  }

  if (widthInput.value === "" || heightInput.value === "") {
    alertError("Please enter a width and height");
    return;
  }

  // Electron adds a bunch of extra properties to the file object including the path
  const imgPath = img.files[0].path;
  const width = widthInput.value;
  const height = heightInput.value;

  ipcRenderer.send("image:resize", {
    imgPath,
    height,
    width,
  });
}

async function selectImportDirectory(e) {
  e.preventDefault();
  e.stopPropagation();
  importDir = await api.selectDir({ message: "Select an Import Folder" });
  if (importDir) {
    dirLabel.setAttribute("style", "background-color: #d1ffdd;");
  }
  checkFormValidation();
}

async function selectEagleLibrary(e) {
  e.preventDefault();
  e.stopPropagation();
  library = await api.selectDir({ message: "Select an Eagle Library" });
  if (library) {
    libLabel.setAttribute("style", "background-color: #d1ffdd;");
  }
  checkFormValidation();
}

function checkFormValidation() {
  if (library && importDir) {
    submitButton.style.display = "block";
    libraryPath.innerText = library;
    importPath.innerText = importDir;
  }
}

async function importImages(e) {
  console.log();
  e.preventDefault();
  e.stopPropagation();
  form.style.display = "none";
  await api.importImages({ library, importDir });

  // const { matches, uniqueImages } = await api.importImages({ library, importDir });
  // if (matches.length > 0) {
  //     // pickFromMatches
  // }

  // api.updateLibararyImages([...uniqueImages, existingImages]);
  // api.addImagesToLibrary(newImages)
}

async function compareAndPick({ existingImage, newImage }) {
  // show both images to user
  // they can choose: existingImage, newImage, both
}

// When done, show message
// ipcRenderer.on("image:done", () =>
//     alertSuccess(`Image resized to ${heightInput.value} x ${widthInput.value}`)
// );

function alertSuccess(message) {
  Toastify.toast({
    text: message,
    duration: 5000,
    close: false,
    style: {
      background: "green",
      color: "white",
      textAlign: "center",
    },
  });
}

function alertError(message) {
  Toastify.toast({
    text: message,
    duration: 5000,
    close: false,
    style: {
      background: "red",
      color: "white",
      textAlign: "center",
    },
  });
}

// // File select listener
// img.addEventListener("change", loadImage);
// Form submit listener
form.addEventListener("submit", importImages);

dir.addEventListener("click", selectImportDirectory);

lib.addEventListener("click", selectEagleLibrary);
