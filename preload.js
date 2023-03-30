const os = require("os");
const path = require("path");
const { contextBridge, ipcRenderer } = require("electron");
const Toastify = require("toastify-js");

contextBridge.exposeInMainWorld("os", {
    homedir: () => os.homedir(),
});

contextBridge.exposeInMainWorld("path", {
    join: (...args) => path.join(...args),
});

contextBridge.exposeInMainWorld("ipcRenderer", {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, func) =>
        ipcRenderer.on(channel, (event, ...args) => func(...args)),

});


contextBridge.exposeInMainWorld("Toastify", {
    toast: (options) => Toastify(options).showToast(),
});

const WINDOW_API = {
    selectDir: (data) => ipcRenderer.invoke("dir:select", data),
    importImages: (data) => ipcRenderer.invoke("images:import", data),
    callback: ({ key, value }) => ipcRenderer.send("callback", { key, value })
}

contextBridge.exposeInMainWorld("api", WINDOW_API);