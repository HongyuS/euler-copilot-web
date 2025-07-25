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
import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { createDefaultWindow, createChatWindow } from './create';

// 保存对主窗口和聊天窗口的引用，方便在托盘菜单中使用
let defaultWindow: BrowserWindow | null = null;
let chatWindow: BrowserWindow | null = null;

export function createTray(): Tray {
  let appTray: Tray | null = null;

  if (appTray) return appTray;

  // 获取窗口引用
  defaultWindow =
    BrowserWindow.getAllWindows().find((win) =>
      win.webContents.getURL().includes('main'),
    ) || null;

  chatWindow =
    BrowserWindow.getAllWindows().find((win) =>
      win.webContents.getURL().includes('chat'),
    ) || null;

  // 如果没有找到窗口，尝试创建它们
  if (!defaultWindow) {
    defaultWindow = createDefaultWindow();
  }

  if (!chatWindow) {
    chatWindow = createChatWindow();
  }

  const trayMenus: MenuItemConstructorOptions[] = [
    {
      label: '显示主窗口',
      click: () => {
        if (defaultWindow) {
          defaultWindow.show();
          defaultWindow.focus();
        } else {
          defaultWindow = createDefaultWindow();
          defaultWindow.show();
        }
      },
    },
    {
      label: '启动快捷问答',
      click: () => {
        if (chatWindow) {
          chatWindow.show();
          chatWindow.focus();
        } else {
          chatWindow = createChatWindow();
          chatWindow.show();
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.exit();
      },
    },
  ];
  const iconPath =
    process.platform === 'darwin'
      ? path.join(__dirname, '../trayTemplate.png')
      : path.join(__dirname, '../tray.png');
  appTray = new Tray(iconPath);
  // 根据平台处理图标
  if (process.platform === 'win32') {
    // Windows平台直接设置图标
    appTray.setImage(iconPath);
  } else if (process.platform === 'darwin') {
    // macOS 平台需要调整尺寸并设置为模板图像
    const image = nativeImage.createFromPath(iconPath);
    const resizedImage = image.resize({ width: 18, height: 18 });
    resizedImage.setTemplateImage(true);
    appTray.setImage(resizedImage);
  } else if (process.platform === 'linux') {
    // Linux 平台需要调整尺寸
    const image = nativeImage.createFromPath(iconPath);
    const resizedImage = image.resize({ width: 18, height: 18 });
    appTray.setImage(resizedImage);
  }
  const contextMenu = Menu.buildFromTemplate(trayMenus);
  appTray.setToolTip('openEuler Intelligence');

  appTray.setContextMenu(contextMenu);
  return appTray;
}
