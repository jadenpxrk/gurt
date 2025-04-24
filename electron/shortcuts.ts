import { app, globalShortcut } from "electron";

import { IShortcutsHelperDeps } from "./main";

export class ShortcutsHelper {
  private deps: IShortcutsHelperDeps;
  private shortcuts: { [key: string]: () => void } = {};

  constructor(deps: IShortcutsHelperDeps) {
    this.deps = deps;

    // Define all shortcuts and their handlers
    this.shortcuts = {
      "CommandOrControl+Shift+\\": async () => {
        const mainWindow = this.deps.getMainWindow();
        if (mainWindow) {
          console.log("Taking screenshot...");
          try {
            const screenshotPath = await this.deps.takeScreenshot();
            const preview = await this.deps.getImagePreview(screenshotPath);
            mainWindow.webContents.send("screenshot-taken", {
              path: screenshotPath,
              preview,
            });
          } catch (error) {
            console.error("Error capturing screenshot:", error);
          }
        }
      },
      "CommandOrControl+Enter": async () => {
        await this.deps.processingHelper?.processScreenshots();
      },
      "CommandOrControl+R": () => {
        console.log(
          "Command + R pressed. Canceling requests and resetting queues..."
        );
        this.deps.processingHelper?.cancelOngoingRequests();
        this.deps.clearQueues();
        console.log("Cleared queues.");
        this.deps.setView("queue");
        const mainWindow = this.deps.getMainWindow();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("reset-view");
          mainWindow.webContents.send("reset");
        }
      },
      "CommandOrControl+Left": () => {
        console.log("Command/Ctrl + Left pressed. Moving window left.");
        this.deps.moveWindowLeft();
      },
      "CommandOrControl+Right": () => {
        console.log("Command/Ctrl + Right pressed. Moving window right.");
        this.deps.moveWindowRight();
      },
      "CommandOrControl+Down": () => {
        console.log("Command/Ctrl + down pressed. Moving window down.");
        this.deps.moveWindowDown();
      },
      "CommandOrControl+Up": () => {
        console.log("Command/Ctrl + Up pressed. Moving window Up.");
        this.deps.moveWindowUp();
      },
    };
  }

  private registerAppShortcuts(): void {
    Object.entries(this.shortcuts).forEach(([key, handler]) => {
      globalShortcut.register(key, handler);
    });
  }

  private unregisterAppShortcuts(): void {
    Object.keys(this.shortcuts).forEach((key) => {
      globalShortcut.unregister(key);
    });
  }

  public registerGlobalShortcuts(): void {
    // Toggle window shortcut - this one should always work
    globalShortcut.register("CommandOrControl+\\", () => {
      const wasVisible = this.deps.isWindowUsable();
      this.deps.toggleMainWindow();

      // If the window was visible and is now being hidden, unregister the shortcuts
      if (wasVisible) {
        this.unregisterAppShortcuts();
      } else {
        // If the window was hidden and is now being shown, register the shortcuts
        this.registerAppShortcuts();
      }
    });

    // Register initial shortcuts if window is visible
    if (this.deps.isWindowUsable()) {
      this.registerAppShortcuts();
    }

    // Unregister all shortcuts when quitting
    app.on("will-quit", () => {
      globalShortcut.unregisterAll();
    });
  }
}
