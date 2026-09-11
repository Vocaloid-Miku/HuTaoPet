import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  screen,
  dialog,
  protocol,
  net,
  Tray,
  Menu,
  nativeImage,
  type OpenDialogOptions
} from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  getCurrentAppearance,
  getSavedAppearance,
  getAppearanceConfigPath,
  getAppearanceGeneration,
  initializeAppearanceConfig,
  loadDefaultAppearance,
  previewAppearanceConfig,
  resetAppearanceConfig,
  restoreDefaultAppearanceConfig,
  replaceAppearanceConfig,
  saveAppearanceConfig,
  setAppearanceConfigPath
} from './appearanceConfig'
import { normalizeAppearanceConfig, sanitizeSpeechTextsForSave } from '../shared/appearance'
import {
  getSavedSystemConfig,
  getSoundFolderPath,
  getSystemConfig,
  getSystemConfigPath,
  getThemeFolderPath,
  initializeSystemConfig,
  loadDefaultSystemConfig,
  resetSystemConfig,
  restoreDefaultSystemConfig,
  saveSystemConfig,
  setAutoStart,
  updateSoundFolderPath,
  updateThemeFolderPath
} from './systemConfig'
import {
  addAudioEntry,
  deleteAudioEntry,
  readAudioEntries,
  readClickSoundBuffer,
  updateAudioEntry
} from './audioConfig'
import {
  getActiveCharacterPackUrls,
  getActiveThemeId,
  listThemeOptions,
  readThemeAppearance,
  readThemeConfig,
  readThemeDefaultAppearance,
  resolveActiveThemeAsset,
  setActiveTheme,
  writeActiveThemeAppearance
} from './themeConfig'
import { createTheme, deleteTheme, getThemeDetail, updateTheme } from './themeImport'
import {
  getAudioSettings,
  getAudioSettingsPath,
  setAudioSettingsPath,
  initializeAudioSettings,
  updateClickSoundName,
  updateSoundEnabled,
  updateSoundPlaybackSettings,
  updateSoundVolume
} from './audioSettingsConfig'

const MIN_PET_SIZE = 180
const MAX_PET_SIZE = 480
const MODAL_WIDTH = 880
const MODAL_HEIGHT = 560

let mainWindow: BrowserWindow | null = null
let modalWindow: BrowserWindow | null = null
let tray: Tray | null = null
let cursorTrackingTimer: NodeJS.Timeout | null = null

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'pettheme',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true
    }
  }
])

function registerThemeProtocol(): void {
  protocol.handle('pettheme', (request) => {
    try {
      const url = new URL(request.url)
      const assetName = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      const filePath = resolveActiveThemeAsset(assetName)
      if (!filePath) {
        return new Response('Not Found', { status: 404 })
      }
      return net.fetch(pathToFileURL(filePath).href)
    } catch (error) {
      console.warn('Failed to serve theme asset:', error)
      return new Response('Error', { status: 500 })
    }
  })
}

function clampPetSize(size: number): number {
  const rounded = Math.round(size / 10) * 10
  return Math.min(MAX_PET_SIZE, Math.max(MIN_PET_SIZE, rounded))
}

function getPetBottomRightPosition(size: number): { x: number; y: number } {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: workArea.x + workArea.width - size,
    y: workArea.y + workArea.height - size
  }
}

function setPetWindowSize(size: number): number {
  const nextSize = clampPetSize(size)

  if (!mainWindow || mainWindow.isDestroyed()) {
    return nextSize
  }

  const { x, y } = getPetBottomRightPosition(nextSize)
  mainWindow.setBounds({
    x,
    y,
    width: nextSize,
    height: nextSize
  })

  return nextSize
}

function getScreenCenterPosition(width: number, height: number): { x: number; y: number } {
  const { bounds } = screen.getPrimaryDisplay()
  return {
    x: Math.round(bounds.x + (bounds.width - width) / 2),
    y: Math.round(bounds.y + (bounds.height - height) / 2)
  }
}

function createModalWindow(): void {
  if (modalWindow && !modalWindow.isDestroyed()) {
    if (modalWindow.isMinimized()) {
      modalWindow.restore()
    }
    modalWindow.focus()
    return
  }

  const { x, y } = getScreenCenterPosition(MODAL_WIDTH, MODAL_HEIGHT)

  const win = new BrowserWindow({
    width: MODAL_WIDTH,
    height: MODAL_HEIGHT,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    minimizable: true,
    maximizable: false,
    skipTaskbar: true,
    hasShadow: true,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  modalWindow = win

  win.on('closed', () => {
    // Only clear if this closed window is still the active modal reference.
    // Prevents a late "closed" from wiping a newly opened modal.
    if (modalWindow === win) {
      modalWindow = null
    }
  })

  win.on('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show()
      win.focus()
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/modal.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/modal.html'))
  }
}

function closeModalWindow(): void {
  if (!modalWindow || modalWindow.isDestroyed()) {
    modalWindow = null
    return
  }

  const win = modalWindow
  // Let the "closed" handler clear the reference for this instance.
  win.close()
}

function minimizeModalWindow(): void {
  if (!modalWindow || modalWindow.isDestroyed()) return
  // With skipTaskbar, hide instead of minimize so the window is not lost.
  modalWindow.hide()
}

function isModalOpen(): boolean {
  return Boolean(modalWindow && !modalWindow.isDestroyed() && modalWindow.isVisible())
}

function openModalWindow(): void {
  if (modalWindow && !modalWindow.isDestroyed()) {
    if (modalWindow.isMinimized()) modalWindow.restore()
    modalWindow.show()
    modalWindow.focus()
    return
  }
  createModalWindow()
}

function toggleModalWindow(): void {
  if (!isModalOpen()) {
    openModalWindow()
    return
  }

  closeModalWindow()
}

function destroyTray(): void {
  if (!tray) return
  tray.destroy()
  tray = null
}

function createTray(): void {
  if (tray) return

  const image = nativeImage.createFromPath(icon)
  // Windows tray looks best around 16–32px; keep aspect via resize.
  const trayImage =
    process.platform === 'win32' && !image.isEmpty()
      ? image.resize({ width: 16, height: 16, quality: 'best' })
      : image
  tray = new Tray(trayImage.isEmpty() ? icon : trayImage)
  tray.setToolTip('胡桃桌宠')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '打开设置',
        click: () => openModalWindow()
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.quit()
        }
      }
    ])
  )
  tray.on('click', () => {
    toggleModalWindow()
  })
  tray.on('double-click', () => {
    openModalWindow()
  })
}

function startCursorTracking(win: BrowserWindow): void {
  if (cursorTrackingTimer) return

  cursorTrackingTimer = setInterval(() => {
    if (win.isDestroyed()) {
      stopCursorTracking()
      return
    }

    const point = screen.getCursorScreenPoint()
    const bounds = win.getBounds()

    win.webContents.send('cursor-position', {
      x: point.x - bounds.x,
      y: point.y - bounds.y
    })
  }, 16)
}

function stopCursorTracking(): void {
  if (!cursorTrackingTimer) return

  clearInterval(cursorTrackingTimer)
  cursorTrackingTimer = null
}

function createWindow(): void {
  initializeSystemConfig()
  initializeAudioSettings()
  const appearance = initializeAppearanceConfig()
  const { x, y } = getPetBottomRightPosition(appearance.petSize)

  mainWindow = new BrowserWindow({
    width: appearance.petSize,
    height: appearance.petSize,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.setIgnoreMouseEvents(true, { forward: true })
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    stopCursorTracking()
    closeModalWindow()
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function focusExistingInstance(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
  }
  openModalWindow()
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    focusExistingInstance()
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.hutaopet')
  registerThemeProtocol()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.on('set-ignore-mouse-events', (event, ignore: boolean, forward = false) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.setIgnoreMouseEvents(ignore, { forward })
  })

  ipcMain.on('start-cursor-tracking', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) startCursorTracking(win)
  })

  ipcMain.on('stop-cursor-tracking', () => {
    stopCursorTracking()
  })

  ipcMain.on('toggle-modal', () => {
    toggleModalWindow()
  })

  ipcMain.on('open-modal', () => {
    openModalWindow()
  })

  ipcMain.on('close-modal', () => {
    closeModalWindow()
  })

  ipcMain.on('minimize-modal', () => {
    minimizeModalWindow()
  })

  ipcMain.handle('get-appearance-config', () => getCurrentAppearance())

  ipcMain.handle('get-saved-appearance-config', () => getSavedAppearance())

  ipcMain.handle('get-appearance-config-path', () => getAppearanceConfigPath())

  ipcMain.handle('get-appearance-generation', () => getAppearanceGeneration())

  ipcMain.handle('set-appearance-config-path', (_event, path: string) => {
    return setAppearanceConfigPath(mainWindow, String(path ?? ''), setPetWindowSize)
  })

  ipcMain.handle('pick-appearance-config-file', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      title: '选择外观配置文件',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    }

    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle('get-default-appearance-config', () => loadDefaultAppearance())

  ipcMain.handle('set-appearance-config', (_event, partial, clientGeneration?: number) => {
    return previewAppearanceConfig(mainWindow, partial, setPetWindowSize, clientGeneration)
  })

  ipcMain.handle('save-appearance-config', (_event, config) => {
    return saveAppearanceConfig(mainWindow, config, setPetWindowSize)
  })

  ipcMain.handle('reset-appearance-config', () => {
    return resetAppearanceConfig(mainWindow, setPetWindowSize)
  })

  ipcMain.handle('restore-default-appearance-config', () => {
    return restoreDefaultAppearanceConfig(mainWindow, setPetWindowSize)
  })

  ipcMain.handle('restore-appearance-from-active-theme', () => {
    const activeId = getActiveThemeId()
    if (!activeId) {
      throw new Error('当前没有激活主题')
    }
    const raw = readThemeAppearance(activeId)
    if (raw == null) {
      throw new Error('主题外观配置不存在')
    }
    return saveAppearanceConfig(
      mainWindow,
      normalizeAppearanceConfig(raw),
      setPetWindowSize
    )
  })

  ipcMain.handle('apply-appearance-to-active-theme', (_event, config) => {
    const next = normalizeAppearanceConfig({
      ...(config && typeof config === 'object' ? config : {}),
      speechTexts: sanitizeSpeechTextsForSave(config?.speechTexts)
    })
    if (!writeActiveThemeAppearance(next)) {
      throw new Error('写入主题外观失败')
    }
    return next
  })

  ipcMain.handle('get-system-config', () => getSystemConfig())

  ipcMain.handle('get-saved-system-config', () => getSavedSystemConfig())

  ipcMain.handle('get-system-config-path', () => getSystemConfigPath())

  ipcMain.handle('get-default-system-config', () => loadDefaultSystemConfig())

  ipcMain.handle('save-system-config', (_event, config) => {
    return saveSystemConfig(config)
  })

  ipcMain.handle('set-auto-start', (_event, enabled: boolean) => {
    return setAutoStart(Boolean(enabled))
  })

  ipcMain.handle('reset-system-config', () => resetSystemConfig())

  ipcMain.handle('restore-default-system-config', () => restoreDefaultSystemConfig())

  ipcMain.handle('get-sound-folder-path', () => getSoundFolderPath())

  ipcMain.handle('get-click-sound-buffer', () => {
    return readClickSoundBuffer(getAudioSettings().clickSoundName)
  })

  ipcMain.handle('get-audio-entries', () => readAudioEntries())

  ipcMain.handle('add-audio-entry', (_event, entry: { name: string; path: string }) => {
    return addAudioEntry({
      name: String(entry?.name ?? ''),
      path: String(entry?.path ?? '')
    })
  })

  ipcMain.handle(
    'update-audio-entry',
    (_event, payload: { oldName: string; name: string; path: string }) => {
      return updateAudioEntry(String(payload?.oldName ?? ''), {
        name: String(payload?.name ?? ''),
        path: String(payload?.path ?? '')
      })
    }
  )

  ipcMain.handle('delete-audio-entry', (_event, name: string) => {
    return deleteAudioEntry(String(name ?? ''))
  })

  ipcMain.handle('get-audio-settings', () => getAudioSettings())

  ipcMain.handle('get-audio-settings-path', () => getAudioSettingsPath())

  ipcMain.handle('set-audio-settings-path', (_event, path: string) => {
    return setAudioSettingsPath(String(path ?? ''))
  })

  ipcMain.handle('pick-sound-config-file', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      title: '选择声音配置文件',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('set-click-sound-name', (_event, name: string) => {
    return updateClickSoundName(String(name ?? ''))
  })

  ipcMain.handle('set-sound-enabled', (_event, enabled: boolean) => {
    return updateSoundEnabled(Boolean(enabled))
  })

  ipcMain.handle('set-sound-volume', (_event, volume: number) => {
    return updateSoundVolume(Number(volume))
  })

  ipcMain.handle(
    'set-sound-settings',
    (_event, settings: { soundEnabled: boolean; soundVolume: number }) => {
      return updateSoundPlaybackSettings({
        soundEnabled: Boolean(settings?.soundEnabled),
        soundVolume: Number(settings?.soundVolume)
      })
    }
  )

  ipcMain.handle('get-theme-folder-path', () => getThemeFolderPath())

  ipcMain.handle('get-theme-config', () => readThemeConfig())

  ipcMain.handle('get-theme-options', () => listThemeOptions())

  ipcMain.handle('get-theme-default-appearance', () => readThemeDefaultAppearance())

  ipcMain.handle('get-active-theme-id', () => getActiveThemeId())

  ipcMain.handle('set-active-theme', (_event, themeId: string) => {
    const result = setActiveTheme(String(themeId ?? ''))
    let appearance = getCurrentAppearance()
    if (result.appearance != null) {
      appearance = replaceAppearanceConfig(
        mainWindow,
        normalizeAppearanceConfig(result.appearance),
        setPetWindowSize
      )
    }
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('theme-changed', result.config)
      }
    }
    return {
      config: result.config,
      appearance
    }
  })

  ipcMain.handle('get-active-character-pack', () => getActiveCharacterPackUrls())

  ipcMain.handle('pick-theme-image', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      title: '选择主题图片',
      filters: [{ name: 'PNG', extensions: ['png'] }],
      properties: ['openFile']
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('create-theme', (_event, payload) => {
    return createTheme(payload)
  })

  ipcMain.handle('get-theme-detail', (_event, themeId: string) => {
    return getThemeDetail(String(themeId ?? ''))
  })

  ipcMain.handle('update-theme', (_event, payload) => {
    const result = updateTheme(payload)
    if (result.config.activeTheme === result.theme.id) {
      replaceAppearanceConfig(mainWindow, normalizeAppearanceConfig(payload.appearance), setPetWindowSize)
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('theme-changed', result.config)
        }
      }
    }
    return result
  })

  ipcMain.handle('delete-theme', (_event, themeId: string) => {
    const result = deleteTheme(String(themeId ?? ''))
    if (result.switched) {
      if (result.appearance != null) {
        replaceAppearanceConfig(
          mainWindow,
          normalizeAppearanceConfig(result.appearance),
          setPetWindowSize
        )
      }
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('theme-changed', result.config)
        }
      }
    }
    return result
  })

  ipcMain.handle('set-sound-folder-path', (_event, path: string) => {
    updateSoundFolderPath(String(path ?? ''))
    initializeAudioSettings()
    return getSoundFolderPath()
  })

  ipcMain.handle('set-theme-folder-path', (_event, path: string) => {
    updateThemeFolderPath(String(path ?? ''))
    return getThemeFolderPath()
  })

  ipcMain.handle('pick-sound-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      title: '选择声音文件夹',
      properties: ['openDirectory']
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('pick-sound-file', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      title: '选择音频文件',
      filters: [
        { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'] },
        { name: '全部文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('pick-theme-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      title: '选择主题文件夹',
      properties: ['openDirectory']
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('open-external-url', async (_event, url: string) => {
    const target = String(url ?? '').trim()
    if (!target) return false
    await shell.openExternal(target)
    return true
  })

  createTray()
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  destroyTray()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
