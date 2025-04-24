import { BackslashIcon, EnterIcon, GearIcon, UpArrowIcon } from "../icons";
import React, { useEffect, useRef, useState } from "react";

import { COMMAND_KEY } from "../../utils/platform";
import { LanguageSelector } from "../shared/LanguageSelector";
import { useToast } from "../../contexts/toast";

interface QueueCommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void;
  screenshotCount?: number;
  currentLanguage: string;
  setLanguage: (language: string) => void;
}

const QueueCommands: React.FC<QueueCommandsProps> = ({
  onTooltipVisibilityChange,
  screenshotCount = 0,
  currentLanguage,
  setLanguage,
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    let tooltipHeight = 0;
    if (tooltipRef.current && isTooltipVisible) {
      tooltipHeight = tooltipRef.current.offsetHeight + 10;
    }
    onTooltipVisibilityChange(isTooltipVisible, tooltipHeight);
  }, [isTooltipVisible]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsTooltipVisible(true);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (
      relatedTarget?.closest('[role="listbox"]') ||
      relatedTarget?.closest("[data-radix-select-viewport]") ||
      relatedTarget?.closest("[data-radix-select-content]")
    ) {
      return;
    }

    // Don't close if hovering over the tooltip content
    if (tooltipRef.current?.contains(relatedTarget)) {
      return;
    }

    timeoutRef.current = setTimeout(() => {
      setIsTooltipVisible(false);
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div>
      <div className="pt-2 w-fit">
        <div className="text-xs text-foreground backdrop-blur-md bg-background/80 rounded-lg py-2 px-4 flex items-center justify-center gap-4">
          {/* Screenshot */}
          <div
            className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted transition-colors"
            onClick={async () => {
              try {
                const result = await window.electronAPI.triggerScreenshot();
                if (!result.success) {
                  console.error("Failed to take screenshot:", result.error);
                  showToast("Error", "Failed to take screenshot", "error");
                }
              } catch (error) {
                console.error("Error taking screenshot:", error);
                showToast("Error", "Failed to take screenshot", "error");
              }
            }}
          >
            <span className="text-xs leading-none truncate">
              {screenshotCount === 0
                ? "Take first screenshot"
                : screenshotCount === 1
                ? "Take second screenshot"
                : "Reset first screenshot"}
            </span>
            <div className="flex gap-1">
              <button className="bg-muted rounded-md px-1.5 py-1 text-xs leading-none">
                {COMMAND_KEY}
              </button>
              <button className="bg-muted rounded-md px-1.5 py-1 text-xs leading-none">
                {UpArrowIcon}
              </button>
              <button className="bg-muted rounded-md px-1.5 py-1 text-xs leading-none">
                {BackslashIcon}
              </button>
            </div>
          </div>

          {/* Solve Command */}
          {screenshotCount > 0 && (
            <div
              className="flex flex-col cursor-pointer rounded px-2 py-1.5 hover:bg-muted transition-colors"
              onClick={async () => {
                try {
                  const result =
                    await window.electronAPI.triggerProcessScreenshots();
                  if (!result.success) {
                    console.error(
                      "Failed to process screenshots:",
                      result.error
                    );
                    showToast(
                      "Error",
                      "Failed to process screenshots",
                      "error"
                    );
                  }
                } catch (error) {
                  console.error("Error processing screenshots:", error);
                  showToast("Error", "Failed to process screenshots", "error");
                }
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs leading-none">Solve </span>
                <div className="flex gap-1 ml-2">
                  <button className="bg-muted rounded-md px-1.5 py-1 text-xs leading-none text-muted-foreground">
                    {COMMAND_KEY}
                  </button>
                  <button className="bg-muted rounded-md px-1.5 py-1 text-xs leading-none text-muted-foreground">
                    {EnterIcon}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Separator */}
          <div className="mx-2 h-4 w-px bg-border" />

          {/* Settings with Tooltip */}
          <div
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="w-4 h-4 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              <GearIcon />
            </div>

            {/* Tooltip Content */}
            {isTooltipVisible && (
              <div
                ref={tooltipRef}
                className="absolute top-full left-0 mt-4 w-80 transform -translate-x-[calc(50%-12px)] z-[100]"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Add transparent bridge */}
                <div className="absolute -top-2 right-0 w-full h-2" />
                <div className="p-3 text-xs bg-background/80 backdrop-blur-md rounded-lg border border-border text-foreground shadow-lg">
                  <div className="space-y-4">
                    <h3 className="font-medium truncate">Keyboard Shortcuts</h3>
                    <div className="space-y-3">
                      {/* Toggle Command */}
                      <div
                        className="cursor-pointer rounded px-2 py-1.5 hover:bg-muted transition-colors"
                        onClick={async () => {
                          try {
                            const result =
                              await window.electronAPI.toggleMainWindow();
                            if (!result.success) {
                              console.error(
                                "Failed to toggle window:",
                                result.error
                              );
                              showToast(
                                "Error",
                                "Failed to toggle window",
                                "error"
                              );
                            }
                          } catch (error) {
                            console.error("Error toggling window:", error);
                            showToast(
                              "Error",
                              "Failed to toggle window",
                              "error"
                            );
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">Toggle Window</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-muted px-1.5 py-0.5 rounded text-xs leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-muted px-1.5 py-0.5 rounded text-xs leading-none">
                              ⇧
                            </span>
                            <span className="bg-muted px-1.5 py-0.5 rounded text-xs leading-none">
                              \
                            </span>
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground truncate mt-1">
                          Show or hide this window.
                        </p>
                      </div>

                      {/* Screenshot Command */}
                      <div
                        className="cursor-pointer rounded px-2 py-1.5 hover:bg-muted transition-colors"
                        onClick={async () => {
                          try {
                            const result =
                              await window.electronAPI.triggerScreenshot();
                            if (!result.success) {
                              console.error(
                                "Failed to take screenshot:",
                                result.error
                              );
                              showToast(
                                "Error",
                                "Failed to take screenshot",
                                "error"
                              );
                            }
                          } catch (error) {
                            console.error("Error taking screenshot:", error);
                            showToast(
                              "Error",
                              "Failed to take screenshot",
                              "error"
                            );
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">Take Screenshot</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-muted px-1.5 py-0.5 rounded text-xs leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-muted px-1.5 py-0.5 rounded text-xs leading-none">
                              {UpArrowIcon}
                            </span>
                            <span className="bg-muted px-1.5 py-0.5 rounded text-xs leading-none">
                              {BackslashIcon}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground truncate mt-1">
                          Take a screenshot of the problem description.
                        </p>
                      </div>

                      {/* Solve Command */}
                      <div
                        className={`cursor-pointer rounded px-2 py-1.5 hover:bg-muted transition-colors ${
                          screenshotCount > 0
                            ? ""
                            : "opacity-50 cursor-not-allowed"
                        }`}
                        onClick={async () => {
                          if (screenshotCount === 0) return;

                          try {
                            const result =
                              await window.electronAPI.triggerProcessScreenshots();
                            if (!result.success) {
                              console.error(
                                "Failed to process screenshots:",
                                result.error
                              );
                              showToast(
                                "Error",
                                "Failed to process screenshots",
                                "error"
                              );
                            }
                          } catch (error) {
                            console.error(
                              "Error processing screenshots:",
                              error
                            );
                            showToast(
                              "Error",
                              "Failed to process screenshots",
                              "error"
                            );
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">Solve</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-muted px-1.5 py-0.5 rounded text-xs leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-muted px-1.5 py-0.5 rounded text-xs leading-none">
                              {EnterIcon}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground truncate mt-1">
                          {screenshotCount > 0
                            ? "Generate a solution based on the current problem."
                            : "Take a screenshot first to generate a solution."}
                        </p>
                      </div>

                      {/* Reset Command */}
                      <div
                        className="cursor-pointer rounded px-2 py-1.5 hover:bg-muted transition-colors"
                        onClick={async () => {
                          try {
                            const result =
                              await window.electronAPI.triggerReset();
                            if (!result.success) {
                              console.error("Failed to reset:", result.error);
                              showToast("Error", "Failed to reset", "error");
                            }
                          } catch (error) {
                            console.error("Error resetting:", error);
                            showToast("Error", "Failed to reset", "error");
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">Reset</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-muted px-1.5 py-0.5 rounded text-xs leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-muted px-1.5 py-0.5 rounded text-xs leading-none">
                              R
                            </span>
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground truncate mt-1">
                          Reset all screenshots and start over.
                        </p>
                      </div>

                      {/* API Configuration */}
                      <div className="border-t border-border pt-3 mt-3">
                        <h3 className="font-medium truncate px-2 mb-2">
                          API Configuration
                        </h3>
                        <div
                          className="cursor-pointer rounded px-2 py-1.5 hover:bg-muted transition-colors"
                          onClick={() => {
                            // Use a custom event to trigger the API key modal to show
                            const event = new CustomEvent("open-api-settings");
                            document.dispatchEvent(event);
                            setIsTooltipVisible(false);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <span className="truncate">API Models</span>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <span className="bg-primary/30 text-primary px-1.5 py-0.5 rounded text-xs leading-none">
                                Default
                              </span>
                            </div>
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground truncate mt-1 pl-6">
                            Configure API key and select models from different
                            providers.
                          </p>
                        </div>
                      </div>

                      {/* Language Selector */}
                      <div className="border-t border-border pt-3 mt-3">
                        <h3 className="font-medium truncate px-2 mb-2">
                          Programming Language
                        </h3>
                        <LanguageSelector
                          currentLanguage={currentLanguage}
                          setLanguage={setLanguage}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueueCommands;
