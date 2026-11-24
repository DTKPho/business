// Application de bureau « Paddock — Carrière F1 » (Electron).
// Charge le jeu (fichier unique dist-app/index.html) dans une fenêtre dédiée.
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: '#0d0d13',
    title: 'Paddock — Carrière F1',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  // Les liens externes s'ouvrent dans le navigateur
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadFile(path.join(__dirname, '..', 'dist-app', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
