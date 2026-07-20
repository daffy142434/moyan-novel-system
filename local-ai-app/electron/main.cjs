const { app, BrowserWindow, ipcMain, Menu, dialog, Notification } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: "default",
    backgroundColor: "#0f1117",
    show: false,
  });

  // Load the Vite dev server or built files
  const isDev = process.env.NODE_ENV === "development" || process.argv.includes("--dev");
  if (isDev) {
    mainWindow.loadURL("http://localhost:1420");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
}

// ====== IPC Handlers ======

// LLM Chat Completion
ipcMain.handle("chat:complete", async (_event, { messages, modelId, apiKey, baseUrl, temperature, maxTokens }) => {
  try {
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: temperature || 0.7,
        max_tokens: maxTokens || 4096,
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error (${response.status}): ${text}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } catch (err) {
    throw new Error(err.message);
  }
});

// LLM Chat Completion (Streaming)
ipcMain.handle("chat:stream", async (event, { messages, modelId, apiKey, baseUrl, temperature, maxTokens }) => {
  try {
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: temperature || 0.7,
        max_tokens: maxTokens || 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error (${response.status}): ${text}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || "";
            if (content) {
              fullContent += content;
              event.sender.send("stream:chunk", content);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }

    event.sender.send("stream:done", fullContent);
    return fullContent;
  } catch (err) {
    event.sender.send("stream:error", err.message);
    throw err;
  }
});

// Data storage (simple JSON file-based)
const store = {
  conversations: [],
  prompts: [],
  settings: {},
};

const storePath = path.join(app.getPath("userData"), "app-data.json");

function loadStore() {
  try {
    if (fs.existsSync(storePath)) {
      const data = JSON.parse(fs.readFileSync(storePath, "utf-8"));
      Object.assign(store, data);
    }
  } catch (e) {
    console.error("Failed to load store:", e);
  }
}

function saveStore() {
  try {
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error("Failed to save store:", e);
  }
}

ipcMain.handle("store:get", (_event, key) => {
  return store[key] || null;
});

ipcMain.handle("store:set", (_event, { key, value }) => {
  store[key] = value;
  saveStore();
  return true;
});

// ====== Directory Picker ======
ipcMain.handle("dialog:selectDirectory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "选择工作目录",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ====== File Operations (with directory scope validation) ======

function isPathInside(base, target) {
  const relative = path.relative(base, target);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function validatePath(baseDir, requestedPath) {
  const resolved = path.resolve(baseDir, requestedPath);
  if (!isPathInside(baseDir, resolved)) {
    return { ok: false, error: "路径超出工作目录范围", resolved };
  }
  return { ok: true, resolved };
}

// Security: dangerous patterns
const DANGEROUS_PATTERNS = [
  /^rm\s+-rf\s+\/\s*$/i,
  /^rm\s+-rf\s+\/\*$/i,
  /^dd\s+if=\/dev\/zero/i,
  /^mkfs\./i,
  /^format\s+/i,
  /^fdisk\s+/i,
  /^del\s+\/f\s+\/s/i,
  /^rd\s+\/s\s+\/q/i,
  /^shutdown/i,
];

ipcMain.handle("file:checkDangerous", (_event, { command }) => {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command.trim())) {
      return { dangerous: true, message: "检测到高危命令：禁止执行删除系统、格式化等操作" };
    }
  }
  return { dangerous: false };
});

ipcMain.handle("file:list", (_event, { baseDir, subPath = "" }) => {
  try {
    const fullPath = path.resolve(baseDir, subPath);
    if (!isPathInside(baseDir, fullPath)) {
      return { ok: false, error: "路径超出工作目录范围" };
    }
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const files = entries.map((e) => ({
      name: e.name,
      isDir: e.isDirectory(),
      size: e.isFile() ? fs.statSync(path.join(fullPath, e.name)).size : 0,
    }));
    return { ok: true, files, currentPath: subPath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("file:read", (_event, { baseDir, filePath }) => {
  try {
    const fullPath = path.resolve(baseDir, filePath);
    if (!isPathInside(baseDir, fullPath)) {
      return { ok: false, error: "路径超出工作目录范围" };
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("file:write", (_event, { baseDir, filePath, content }) => {
  try {
    const fullPath = path.resolve(baseDir, filePath);
    if (!isPathInside(baseDir, fullPath)) {
      return { ok: false, error: "路径超出工作目录范围" };
    }
    // Ensure parent directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("file:delete", (_event, { baseDir, filePath }) => {
  try {
    const fullPath = path.resolve(baseDir, filePath);
    if (!isPathInside(baseDir, fullPath)) {
      return { ok: false, error: "路径超出工作目录范围" };
    }
    fs.unlinkSync(fullPath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ====== System Notification ======
ipcMain.handle("notification:send", (_event, { title, body }) => {
  try {
    const notification = new Notification({ title, body });
    notification.show();
    return true;
  } catch (err) {
    console.error("Notification error:", err);
    return false;
  }
});

// ====== App Lifecycle ======

// ====== Chinese Menu ======
const menuTemplate = [
  {
    label: "文件",
    submenu: [
      { label: "新建对话", accelerator: "CmdOrCtrl+N", click: () => mainWindow?.webContents.send("menu:new-conversation") },
      { type: "separator" },
      { label: "退出", accelerator: "CmdOrCtrl+Q", role: "quit" },
    ],
  },
  {
    label: "编辑",
    submenu: [
      { label: "撤销", accelerator: "CmdOrCtrl+Z", role: "undo" },
      { label: "重做", accelerator: "Shift+CmdOrCtrl+Z", role: "redo" },
      { type: "separator" },
      { label: "剪切", accelerator: "CmdOrCtrl+X", role: "cut" },
      { label: "复制", accelerator: "CmdOrCtrl+C", role: "copy" },
      { label: "粘贴", accelerator: "CmdOrCtrl+V", role: "paste" },
      { label: "全选", accelerator: "CmdOrCtrl+A", role: "selectAll" },
    ],
  },
  {
    label: "视图",
    submenu: [
      { label: "重新加载", accelerator: "CmdOrCtrl+R", role: "reload" },
      { label: "强制重新加载", accelerator: "CmdOrCtrl+Shift+R", role: "forceReload" },
      { label: "开发者工具", accelerator: "F12", role: "toggleDevTools" },
      { type: "separator" },
      { label: "实际大小", accelerator: "CmdOrCtrl+0", role: "resetZoom" },
      { label: "放大", accelerator: "CmdOrCtrl+=", role: "zoomIn" },
      { label: "缩小", accelerator: "CmdOrCtrl+-", role: "zoomOut" },
      { type: "separator" },
      { label: "全屏", accelerator: "F11", role: "togglefullscreen" },
    ],
  },
  {
    label: "窗口",
    submenu: [
      { label: "最小化", accelerator: "CmdOrCtrl+M", role: "minimize" },
      { label: "关闭", accelerator: "CmdOrCtrl+W", role: "close" },
    ],
  },
  {
    label: "帮助",
    submenu: [
      { label: "关于 Local AI App", click: () => {
        dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "关于 Local AI App",
          message: "Local AI App v0.1.0",
          detail: "本地 AI 对话客户端\n支持 DeepSeek / 豆包 / Kimi / GLM",
        });
      }},
    ],
  },
];

app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
  loadStore();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  saveStore();
  if (process.platform !== "darwin") app.quit();
});
