const path = require("path");
const os = require("os");
const fs = require("fs");
const resizeImg = require("resize-img");
const glob = require("glob");
const jimp = require("jimp");
const Subject = require("rxjs").Subject;
const firstValueFrom = require("rxjs").firstValueFrom;
const filter = require("rxjs").filter;

const addImageToLibrary = require("./lib/eagle").addImageToLibrary;
const updateLibraryItemTags = require("./lib/eagle").updateLibraryItemTags;
const libraryItems = require("./lib/eagle").libraryItems;
const updateLibraryItemImage = require("./lib/eagle").updateLibraryItemImage;

const parseImageTags = require("./lib/exif").parseImageTags;

const compareImageSimilarity = require("./lib/image").compareImageSimilarity;

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

ipcMain.on("callback", (e, { key, value }) => {
  ipcRendererCallback.next({
    key,
    value,
  });
});

ipcMain.handle("dir:select", async (e, options) => {
  console.log("selection options: ", options);
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });

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
  console.log("<< Images Import >>");

  try {
    const srcDir = fs.opendirSync(importDir);
    for await (const entry of srcDir) {
      console.log("ENTRY: ", entry);
      const importImagePath = path.join(importDir, entry.name);
      const importImageTags = await parseImageTags(importImagePath);
      console.log("IMPORT IMAGE TAGS: ", importImageTags);
      let identicalMatchFound = false;

      const items = libraryItems();
      for await (const item of items) {
        const libraryImagePath = path.join(
          library,
          "images",
          `${item.id}.info`,
          `${item.name}.${item.ext}`
        );

        const isSimilar = await compareImageSimilarity(
          libraryImagePath,
          importImagePath
        );
        console.log("IS_SIMILAR: ", isSimilar);

        // resolve image import collision (new image matches existing image)
        switch (isSimilar) {
          case 0: // identical images
            // dont import and stop checking
            console.log("IDENTICAL MATCH FOUND");
            updateLibraryItemTags({
              id: item.id,
              tags: [...importImageTags, ...item.tags].sort((a, b) =>
                a < b ? -1 : 1
              ),
            });
            identicalMatchFound = true;
            break;
          case 1: // similar images
            console.log("SIMILAR MATCH FOUND");
            // TODO add choice to contintue or stop checking (i.e. set identicalMatchFound = true)
            await resolveImageImportCollision({
              importImagePath,
              importImageTags,
              libraryImagePath,
              libraryImageData: item,
            });
            break;
          case -1: // different images
            // continue checking for duplicates
            break;
          default: // error
            break;
        }

        // stop checking if identical match found
        if (identicalMatchFound) {
          break;
        }
      }
    }
  } catch (err) {
    console.log("ERROR IMPORTING IMAGES: ", err);
  }
});

async function resolveImageImportCollision({
  importImagePath,
  importImageTags,
  libraryImagePath,
  libraryImageData,
}) {
  console.log("MATCH FOUND: ", importImagePath, libraryImagePath);
  mainWindow.webContents.send(
    "images:resolve-collision",
    JSON.stringify({
      newImage: {
        src: importImagePath,
        tags: importImageTags,
      },
      existingImage: {
        src: libraryImagePath,
        tags: libraryImageData.tags,
      },
    })
  );

  const { value } = await firstValueFrom(
    ipcRendererCallback.pipe(
      filter(({ key }) => key === "images:resolve-collision-response")
    )
  );
  console.log("RESPONSE: ", value);

  switch (value) {
    case "KEEP_EXISTING":
      updateLibraryItemTags({
        id: libraryImageData.id,
        tags: [...importImageTags, ...libraryImageData.tags].sort((a, b) =>
          a < b ? -1 : 1
        ),
      });
      break;
    case "REPLACE_WITH_NEW":
      updateLibraryItemImage({
        data: libraryImageData,
        newPath: importImagePath,
      });
      break;
    case "KEEP_BOTH":
      addImageToLibrary({
        path: importImagePath,
        name: entry.name.split(".")[0],
        tags: importImageTags,
      });
      break;
    default:
    //
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
