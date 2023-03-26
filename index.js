const path = require("path");
const os = require("os");
const fs = require("fs");
const resizeImg = require("resize-img");
const glob = require("glob");
const jimp = require("jimp");
const exifr = require("exifr");
const fetch = require("electron-fetch");

const {
    app,
    BrowserWindow,
    Menu,
    ipcMain,
    dialog,
    shell,
} = require("electron");

const isDev = process.env.NODE_ENV !== "production";
const isMac = process.platform === "darwin";

let mainWindow;
let aboutWindow;

// Main Window
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: isDev ? 1000 : 500,
        height: 600,
        icon: `${__dirname}/assets/icons/Icon_256x256.png`,
        resizable: isDev,
        webPreferences: {
            enableRemoteModule: false,
            nodeIntegration: true,
            preload: path.join(__dirname, "preload.js"),
        },
    });

    // Show devtools automatically if in development
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // mainWindow.loadURL(`file://${__dirname}/renderer/index.html`);
    mainWindow.loadFile(path.join(__dirname, "./renderer/index.html"));
}

// About Window
function createAboutWindow() {
    aboutWindow = new BrowserWindow({
        width: 300,
        height: 300,
        title: "About Electron",
        icon: `${__dirname}/assets/icons/Icon_256x256.png`,
    });

    aboutWindow.loadFile(path.join(__dirname, "./renderer/about.html"));
}

// When the app is ready, create the window
app.on("ready", () => {
    createMainWindow();

    const mainMenu = Menu.buildFromTemplate(menu);
    Menu.setApplicationMenu(mainMenu);

    // Remove variable from memory
    mainWindow.on("closed", () => (mainWindow = null));
});

// Menu template
const menu = [
    ...(isMac
        ? [
              {
                  label: app.name,
                  submenu: [
                      {
                          label: "About",
                          click: createAboutWindow,
                      },
                  ],
              },
          ]
        : []),
    {
        role: "fileMenu",
    },
    ...(!isMac
        ? [
              {
                  label: "Help",
                  submenu: [
                      {
                          label: "About",
                          click: createAboutWindow,
                      },
                  ],
              },
          ]
        : []),
    // {
    //   label: 'File',
    //   submenu: [
    //     {
    //       label: 'Quit',
    //       click: () => app.quit(),
    //       accelerator: 'CmdOrCtrl+W',
    //     },
    //   ],
    // },
    ...(isDev
        ? [
              {
                  label: "Developer",
                  submenu: [
                      { role: "reload" },
                      { role: "forcereload" },
                      { type: "separator" },
                      { role: "toggledevtools" },
                  ],
              },
          ]
        : []),
];

// Respond to the resize image event
ipcMain.on("image:resize", (e, options) => {
    // console.log(options);
    options.dest = path.join(os.homedir(), "imageresizer");
    resizeImage(options);
});

ipcMain.on("dir:select", async (e, options) => {
    console.log("selection options: ", options);
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog(
            mainWindow,
            {
                properties: ["openDirectory"],
            }
        );

        if (canceled) {
            return;
        }
        searchImages(filePaths[0], "test");
        mainWindow.webContents.send("dir:selected", filePaths[0]);
        return filePaths[0];
    } catch (err) {
        console.log("ERROR LOADING DIR: ", err);
    }
});

ipcMain.on("import:images", async (e, options) => {
    const { dest, src } = options;
    try {
        const srcDir = fs.opendirSync(`${src}/images`);
        console.log("srcDir: ", srcDir);
        for await (const entry of srcDir) {
            console.log(entry.name);
        }
    } catch (err) {
        console.log("ERROR IMPORTING IMAGES: ", err);
    }
});

async function searchImages(src, dest) {
    console.log("searchImages");
    try {
        const srcDir = fs.opendirSync(`${src}/images`);
        for await (const entry of srcDir) {
            console.log(`${src}/images/${entry.name}`);
            let testImages = fs
                .readdirSync(`${src}/images/${entry.name}`)
                .filter((file) => file.includes("thumbnail"));
            if (testImages[0] == null) {
                testImages = fs
                    .readdirSync(`${src}/images/${entry.name}`)
                    .filter((file) => !file.includes("json"));
            }
            checkForMatches(testImages[0], dest);
        }
    } catch (err) {
        console.log("ERROR IMPORTING IMAGES: ", err);
    }
}

async function checkForMatches(imgSrc, src) {
    try {
        console.log("imgSrc: ", imgSrc);
        // const srcDir = fs.opendirSync(src);
        // for await (const entry of srcDir) {
        //     console.log(entry.name);
        // }
    } catch (err) {
        console.log("ERROR CHECKING FOR MATCHES: ", err);
    }
}

async function compareImageSimilarity(
    filePath_1,
    filePath_2,
    distanceThreshold = 0.15, // The hamming distance threshold (0.15, 15% is a good default value)
    differenceThreshold = 0.15, // The pixel difference threshold (0.15, 15% is a good default value)
    flattenColorChannels = true // If true, the images will be converted to grayscale before comparing, useful for comparing images with different color channels
) {
    const image_1 = await jimp.read(filePath_1);
    const image_2 = await jimp.read(filePath_2);

    let image_1_preprocessed = image_1.clone();
    let image_2_preprocessed = image_2.clone();
    // If flattenColorChannels is true, convert the images to grayscale
    if (flattenColorChannels) {
        image_1_preprocessed = image_1_preprocessed.grayscale();
        image_2_preprocessed = image_2_preprocessed.grayscale();
    }

    // Compare the hashes (hamming distance)
    const distance = jimp.distance(image_1_preprocessed, image_2_preprocessed);

    // Compare the images (pixel difference)
    const difference = jimp.diff(image_1_preprocessed, image_2_preprocessed);

    // If the hamming distance is less than distanceThreshold and the pixel difference is less than differenceThreshold, the images are similar
    if (
        distance < distanceThreshold ||
        difference.percent < differenceThreshold
    ) {
        return true;
    }
    return false;
}

// Resize and save image
async function resizeImage({ imgPath, height, width, dest }) {
    try {
        // console.log(imgPath, height, width, dest);

        // Resize image
        const newPath = await resizeImg(fs.readFileSync(imgPath), {
            width: +width,
            height: +height,
        });

        // Get filename
        const filename = path.basename(imgPath);

        // Create destination folder if it doesn't exist
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        }

        // Write the file to the destination folder
        fs.writeFileSync(path.join(dest, filename), newPath);

        // Send success to renderer
        mainWindow.webContents.send("image:done");

        // Open the folder in the file explorer
        shell.openPath(dest);
    } catch (err) {
        console.log(err);
    }
}

// Quit when all windows are closed.
app.on("window-all-closed", () => {
    if (!isMac) app.quit();
});

// Open a window if none are open (macOS)
app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
