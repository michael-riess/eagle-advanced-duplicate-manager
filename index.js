const path = require("path");
const os = require("os");
const fs = require("fs");
const resizeImg = require("resize-img");
const glob = require("glob");
const jimp = require("jimp");
const fetch = require("electron-fetch").default;
const Subject = require("rxjs").Subject;
const firstValueFrom = require("rxjs").firstValueFrom
const filter = require("rxjs").filter
const ExifTool = require("exiftool-vendored").ExifTool

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


const ipcRendererCallback = new Subject();


// Main Window
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: isDev ? 2000 : 1000,
        height: 600,
        icon: `${__dirname}/assets/icons/Icon_256x256.png`,
        resizable: isDev,
        webPreferences: {
            enableRemoteModule: false,
            nodeIntegration: true,
            preload: path.join(__dirname, "preload.js"),
        },
    });
    mainWindow.maximize();

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
app.on("ready", async () => {
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


ipcMain.on('callback', (e, { key, value }) => {
    ipcRendererCallback.next({
        key,
        value
    });
})

ipcMain.handle("dir:select", async (e, options) => {      
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
        // searchImages(filePaths[0], "test");
        //mainWindow.webContents.send("dir:selected", filePaths[0]);
        return filePaths[0];
    } catch (err) {
        console.log("ERROR LOADING DIR: ", err);
    }
});

ipcMain.handle("images:import", async (e, options) => {
    const { library, importDir } = options;
    console.log('<< Images Import >>');

    try {
        const srcDir = fs.opendirSync(importDir);
        for await (const entry of srcDir) {
            console.log("ENTRY: ", entry);
            const importImagePath = path.join(importDir, entry.name);
            const importImageTags = parseImageTags(importImagePath);

            const items = libraryItems();
            for await (const item of items) {
                const libraryImagePath = path.join(library, 'images', `${item.id}.info`, `${item.name}.${item.ext}`);

                const libraryImage = await jimp.read(libraryImagePath);
                const importImage = await jimp.read(importImagePath)
                const isSimilar = compareImageSimilarity(libraryImage, importImage);
                console.log('IS_SIMILAR: ', isSimilar)

                // resolve image import collision (new image matches existing image)
                if (isSimilar) {
                    console.log('MATCH FOUND: ', importImagePath, libraryImagePath);
                    mainWindow.webContents.send("images:resolve-collision", JSON.stringify({
                        newImage: {
                            src: importImagePath,
                            tags: importImageTags
                        },
                        existingImage: {
                            src: libraryImagePath,
                            tags: item.tags
                        }
                    }));
    
                    const { value } = await firstValueFrom(ipcRendererCallback.pipe(filter(({ key }) => key === 'images:resolve-collision')))
                    console.log('RESPONSE: ', value);

                    switch (value) {
                        case 'KEEP_EXISTING':
                            //
                            break;
                        case 'REPLACE_WITH_NEW':
                            // 
                            break;
                        case 'KEEP_BOTH':
                            //
                            break;
                        default:
                            //
                    }

                    break;

                }
            }

            // add new image to library
            addImageToLibrary({
                path: importImagePath,
                name: entry.name.split('.')[0],
                tags: importImageTags
            })
        }
        console.log(imagesToImport);
    } catch (err) {
        console.log("ERROR IMPORTING IMAGES: ", err);
    }
});

async function parseImageTags(src) {
    const exiftool = new ExifTool({ taskTimeoutMillis: 5000 });
    const { Keywords, Subject } = await exiftool.read(src);
    let tags = []
    if (Keywords?.length > 0) {
        tags = Keywords
    } else if (Subject?.length > 0) {
        tags = Subject
    }
    return tags;
}

async function addImageToLibrary({ path, name, tags }) {
    try {
        const api = 'http://localhost:41595/api/item/addFromPath';
        const body = {  path,  name, tags };
        const result = await fetch(api, { 
            method: 'POST',
            body:    JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        }).then(res => res.json())
        if (result.status === 'error') {
            throw new Error(result);
        }
        console.log('ADDED IMAGE TO LIBRARY: ', result)
    }  catch (error) {
        console.log("ERROR ADDING IMAGE TO LIBRARY: ", error, src)
    }
}

async function* libraryItems() {
    const api = 'http://localhost:41595/api/item/list';
    const limit = 200;
    let offset = 0;
    let allItemsFetched = false;
    while(!allItemsFetched) {
        console.log('LIMIT: ', limit);
        console.log('OFFSET: ', offset);
        const { data } = await fetch(`${api}?limit=${limit}&offset=${offset}`).then((response) => response.json())
        for (item of data) {
            yield item;
        }
        if (data.length < 1) {
            allItemsFetched = true;
        }
        offset += 1;
    }
    return;
}


function compareImageSimilarity(
    image_1,
    image_2,
    distanceThreshold = 0.15, // The hamming distance threshold (0.15, 15% is a good default value)
    differenceThreshold = 0.15, // The pixel difference threshold (0.15, 15% is a good default value)
    flattenColorChannels = true // If true, the images will be converted to grayscale before comparing, useful for comparing images with different color channels
) {
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

    console.log('Distance: ', distance);
    console.log('Difference: ', difference.percent);
    console.log('Compare', distance < distanceThreshold, difference.percent < differenceThreshold, distance < distanceThreshold || difference.percent < differenceThreshold)

    // If the hamming distance is less than distanceThreshold and the pixel difference is less than differenceThreshold, the images are similar
    if (
        distance < distanceThreshold ||
        difference.percent < differenceThreshold
    ) {
        return true;
    }
    return false;
}



// Quit when all windows are closed.
app.on("window-all-closed", () => {
    if (!isMac) app.quit();
});

// Open a window if none are open (macOS)
app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
