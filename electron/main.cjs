// Fenêtre de bureau Electron pour Genesis Magma F1 Team.
// Charge la version compilée (dist/) ; les sauvegardes IndexedDB sont stockées
// dans le dossier de données de l'application et persistent entre les lancements.
const { app, BrowserWindow, shell, Menu } = require('electron')
const path = require('node:path')

// Une seule instance : relancer l'appli ramène la fenêtre existante.
if (!app.requestSingleInstanceLock()) app.quit()

let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0b0b0d',
    title: 'Genesis Magma F1 Team',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  // Les liens externes s'ouvrent dans le navigateur, pas dans le jeu.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.whenReady().then(() => {
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null)
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
