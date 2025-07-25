// Copyright (c) Huawei Technologies Co., Ltd. 2023-2025. All rights reserved.
// licensed under the Mulan PSL v2.
// You can use this software according to the terms and conditions of the Mulan PSL v2.
// You may obtain a copy of Mulan PSL v2 at:
//      http://license.coscl.org.cn/MulanPSL2
// THIS SOFTWARE IS PROVIDED ON AN 'AS IS' BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY OR FIT FOR A PARTICULAR
// PURPOSE.
// See the Mulan PSL v2 for more details.
import path from 'node:path';
import * as electron from 'electron';
import { BrowserWindow, app, ipcMain, Menu } from 'electron';
import { options as allWindow } from './options';
import { updateConf } from '../common/cache-conf';
import { isLinux } from '../common/platform';

// 存储所有创建的窗口实例，用于全局访问
const windowInstances: Map<string, BrowserWindow> = new Map();

export function createWindow(
  options: Electron.BrowserWindowConstructorOptions,
  hash: string,
  id?: string,
): BrowserWindow {
  const win = new BrowserWindow({
    ...options,
    webPreferences: {
      webSecurity: false, // 禁用安全策略（不推荐）
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, '../preload/index.js'),
    },
  });

  // 存储窗口实例以便全局访问
  if (id) {
    windowInstances.set(id, win);
  }

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, `../index.html`), { hash });
  } else {
    win.loadURL(`http://localhost:${process.env.PORT}/#${hash}`);
  }

  // 设置窗口控制事件处理
  setupWindowControls(win);

  // 设置右键上下文菜单
  setupContextMenu(win);

  // 设置窗口打开处理程序
  setupWindowOpenHandler(win);

  return win;
}

/**
 * 为窗口设置控制事件（适用于所有平台）
 */
function setupWindowControls(win: BrowserWindow) {
  // 监听窗口最大化/还原事件
  win.on('maximize', () => {
    if (win.webContents) {
      win.webContents.send('window-maximized-change', true);
    }
  });

  win.on('unmaximize', () => {
    if (win.webContents) {
      win.webContents.send('window-maximized-change', false);
    }
  });
}

/**
 * 设置右键上下文菜单，支持中英文
 */
function setupContextMenu(win: BrowserWindow) {
  win.webContents.on('context-menu', (_event, params) => {
    const nlsEnv = process.env.EULERCOPILOT_NLS_CONFIG;
    let resolved = 'en';
    try {
      const cfg = JSON.parse(nlsEnv || '{}');
      resolved = cfg.resolvedLanguage || 'en';
    } catch {
      resolved = 'en';
    }
    const isZh = resolved.startsWith('zh');
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        role: 'copy',
        label: isZh ? '复制' : 'Copy',
        enabled: params.selectionText.length > 0,
      },
      {
        role: 'paste',
        label: isZh ? '粘贴' : 'Paste',
        enabled: params.editFlags.canPaste,
      },
      { type: 'separator' },
      { role: 'selectAll', label: isZh ? '全选' : 'Select All' },
    ];
    Menu.buildFromTemplate(template).popup({ window: win });
  });
}

function setupWindowOpenHandler(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler((details: Electron.HandlerDetails) => {
    if (details.url) {
      const features = details.features || '';
      const width = parseInt(features.split('width=')[1] || '800', 10);
      const height = parseInt(features.split('height=')[1] || '600', 10);
      const x = parseInt(features.split('left=')[1] || '0', 10);
      const y = parseInt(features.split('top=')[1] || '0', 10);

      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width,
          height,
          autoHideMenuBar: true,
          x,
          y,
          resizable: true,
          webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            webSecurity: false,
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
          },
        },
      };
    }
    return { action: 'deny' };
  });

  // 为新窗口设置右键菜单
  win.webContents.on('did-create-window', (childWindow) => {
    setupContextMenu(childWindow);
  });
}

let defaultWindow: BrowserWindow | null = null;
let chatWindow: BrowserWindow | null = null;

/**
 * 获取窗口标题栏的样式配置
 * @param theme 主题类型 'dark'|'light'
 * @returns Electron.TitleBarOverlay 配置
 */
function getDefaultTitleBarOverlay(
  theme: string = 'light',
): Electron.TitleBarOverlay {
  return {
    color: theme === 'dark' ? '#1f2329' : '#ffffff',
    symbolColor: theme === 'dark' ? 'white' : 'black',
    height: 48,
  };
}

/**
 * 创建默认窗口
 * 仅在第一次调用时创建，后续调用返回已创建的窗口实例
 */
export function createDefaultWindow(): BrowserWindow {
  if (defaultWindow) return defaultWindow;

  const hash = allWindow.mainWindow.hash;
  const defaultWindowOptions = allWindow.mainWindow.window;
  const theme = process.env.EULERCOPILOT_THEME || 'light';

  // 仅在非Linux平台设置titleBarOverlay
  if (!isLinux) {
    defaultWindowOptions.titleBarOverlay = getDefaultTitleBarOverlay(theme);
  }

  defaultWindow = createWindow(defaultWindowOptions, hash, 'mainWindow');

  // 开发模式下可以打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    defaultWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 设置窗口标题并显示窗口
  defaultWindow.webContents.on('did-finish-load', () => {
    defaultWindow?.setTitle('openEuler 智能化解决方案');
    if (defaultWindow && !defaultWindow.isDestroyed()) {
      defaultWindow.show();
    }
  });

  return defaultWindow;
}

/**
 * 计算聊天窗口默认位置
 */
function getDefaultChatWindowPosition(
  windowWidth: number,
  windowHeight: number,
) {
  const rightOffset = 24; // 右侧间距
  // 获取主显示器的工作区尺寸
  const primaryDisplay = electron.screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } =
    primaryDisplay.workAreaSize;

  // x坐标：屏幕宽度 - 窗口宽度 - 右侧间距
  const x = screenWidth - windowWidth - rightOffset;

  // y坐标：上下居中
  const y = Math.round((screenHeight - windowHeight) / 2);

  return { x, y };
}

/**
 * 创建聊天窗口
 * 仅在第一次调用时创建，后续调用返回已创建的窗口实例
 */
export function createChatWindow(): BrowserWindow {
  if (chatWindow) return chatWindow;
  const hash = allWindow.chatWindow.hash;
  const chatWindowOptions = { ...allWindow.chatWindow.window };
  const theme = process.env.EULERCOPILOT_THEME || 'light';

  // 计算窗口位置
  const { x, y } = getDefaultChatWindowPosition(
    chatWindowOptions.width || 680,
    chatWindowOptions.height || 960,
  );

  // 设置窗口位置
  chatWindowOptions.x = x;
  chatWindowOptions.y = y;

  // 仅在非Linux平台设置titleBarOverlay
  if (!isLinux) {
    chatWindowOptions.titleBarOverlay = getDefaultTitleBarOverlay(theme);
  }

  chatWindow = createWindow(chatWindowOptions, hash, 'chatWindow');

  // 设置窗口标题
  chatWindow.webContents.on('did-finish-load', () => {
    chatWindow?.setTitle('快捷问答');
  });

  return chatWindow;
}

// 全局设置IPC事件处理
ipcMain.on('window-control', (e, command) => {
  console.log('Received window control command:', command);

  // 确保命令来自正确的窗口
  const webContents = e.sender;
  const win = BrowserWindow.fromWebContents(webContents);

  if (!win) {
    console.error('Cannot find window for the command');
    return;
  }

  switch (command) {
    case 'minimize':
      console.log('Minimizing window');
      win.minimize();
      break;
    case 'maximize':
      if (win.isMaximized()) {
        console.log('Unmaximizing window');
        win.unmaximize();
      } else {
        console.log('Maximizing window');
        win.maximize();
      }
      break;
    case 'close':
      console.log('Closing window');
      win.close();
      break;
    default:
      console.error('Unknown window command:', command);
  }
});

// 添加查询窗口最大化状态的处理程序
ipcMain.handle('window-is-maximized', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) {
    return win.isMaximized();
  }
  return false;
});

ipcMain.handle('copilot:theme', (e, args) => {
  electron.nativeTheme.themeSource = args.theme;

  // 仅在非Linux平台上更新titleBarOverlay
  if (!isLinux) {
    if (chatWindow) {
      chatWindow.setTitleBarOverlay({
        color: args.backgroundColor,
        symbolColor: args.theme === 'dark' ? 'white' : 'black',
      });
    }

    if (defaultWindow) {
      defaultWindow.setTitleBarOverlay({
        color: args.backgroundColor,
        symbolColor: args.theme === 'dark' ? 'white' : 'black',
      });
    }
  }

  // 通知渲染进程主题已更改，以更新Linux自定义标题栏
  if (isLinux) {
    if (chatWindow && chatWindow.webContents) {
      chatWindow.webContents.send('theme-updated', args);
    }
    if (defaultWindow && defaultWindow.webContents) {
      defaultWindow.webContents.send('theme-updated', args);
    }
  }

  updateConf({
    theme: args.theme,
  });
});

ipcMain.handle('copilot:lang', (e, args) => {
  updateConf({
    userLocale: args.lang,
  });
});
