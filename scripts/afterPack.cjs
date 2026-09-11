const { join } = require('path')
const { existsSync } = require('fs')
const { rcedit } = require('rcedit')

/**
 * Embed build/icon.ico into the Windows executable so desktop/start-menu
 * shortcuts use the app icon even when signAndEditExecutable is disabled.
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const exeName = `${context.packager.appInfo.productFilename}.exe`
  const exePath = join(context.appOutDir, exeName)
  const iconPath = join(context.packager.projectDir, 'build', 'icon.ico')

  if (!existsSync(exePath)) {
    console.warn(`[afterPack] Executable not found: ${exePath}`)
    return
  }
  if (!existsSync(iconPath)) {
    console.warn(`[afterPack] Icon not found: ${iconPath}`)
    return
  }

  await rcedit(exePath, { icon: iconPath })
  console.log(`[afterPack] Applied icon to ${exeName}`)
}
