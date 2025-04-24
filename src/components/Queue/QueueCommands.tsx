import { BackslashIcon, EnterIcon, UpArrowIcon } from "../icons";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import React, { useEffect, useRef, useState } from "react";

import { Button } from "../../components/ui/button";
import { COMMAND_KEY } from "../../utils/platform";
import { Input } from "../../components/ui/input";
import { LanguageSelector } from "../shared/LanguageSelector";
import { Loader2 } from "lucide-react";
import { Settings } from "lucide-react";
import { useToast } from "../../contexts/toast";

interface QueueCommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void;
  screenshotCount?: number;
  currentLanguage: string;
  setLanguage: (language: string) => void;
}

// Define available model options - Moved from APIKeyModal
const MODEL_OPTIONS = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Good balance of quality and speed (OpenAI)",
    default: true,
  },
  {
    id: "o4-mini",
    name: "O4-mini",
    description:
      "Reasoning and problem-solving capabilities while faster than O3 (OpenAI)",
  },
  {
    id: "o3",
    name: "O3",
    description: "Best reasoning and problem-solving capabilities (OpenAI)",
  },
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    description: "GPT-4o outperformer (OpenAI)",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    description: "Fast and efficient Gemini model (Google)",
  },
  {
    id: "gemini-2.5-pro-preview-03-25",
    name: "Gemini 2.5 Pro Preview",
    description: "Latest preview version of Gemini 2.5 Pro (Google)",
  },
  {
    id: "gemini-2.5-flash-preview-04-17",
    name: "Gemini 2.5 Flash Preview 04-17",
    description: "Latest preview version of Gemini 2.5 Flash (Google)",
    default: true,
  },
];

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
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState(
    () => MODEL_OPTIONS.find((model) => model.default)?.id || "o3"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null); // Keep for potential focus needs

  // Load current API key and model when the component mounts (or tooltip opens if preferred)
  useEffect(() => {
    const loadCurrentConfig = async () => {
      try {
        const response = await window.electronAPI.getApiConfig();
        if (response.success) {
          if (response.apiKey) {
            setApiKey(response.apiKey);
          }
          if (response.model) {
            setSelectedModel(response.model);
          }
        }
      } catch (error) {
        console.error("Error loading current API configuration:", error);
        setError("Failed to load configuration"); // Inform user
      }
    };

    loadCurrentConfig();
  }, []); // Load once on mount

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent tooltip closure if inside form

    if (!apiKey.trim()) {
      setError("API key cannot be empty");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.setApiConfig({
        apiKey: apiKey.trim(),
        model: selectedModel,
      });

      if (result.success) {
        showToast("API configuration saved successfully.", "", "success");
        setIsTooltipVisible(false); // Close tooltip on successful save
      } else {
        setError(result.error || "Failed to save configuration");
      }
    } catch (err) {
      setError("An error occurred while saving the configuration");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Effect to clear error when tooltip closes
  useEffect(() => {
    if (!isTooltipVisible) {
      setError(null);
      // Optionally reset apiKey input if desired when tooltip closes without saving
      // loadCurrentConfig(); // Or reload config to discard changes
    }
  }, [isTooltipVisible]);

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

    // Don't close if hovering over the tooltip content, including select dropdowns
    if (
      tooltipRef.current?.contains(relatedTarget) ||
      relatedTarget?.closest('[role="listbox"]') ||
      relatedTarget?.closest("[data-radix-select-viewport]") ||
      relatedTarget?.closest("[data-radix-select-content]")
    ) {
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
    <div className="select-none">
      <div className="pt-2 w-fit">
        <div className="text-xs text-foreground backdrop-blur-md bg-background/80 rounded-lg py-2 px-4 flex items-center justify-center gap-4 pointer-events-none">
          {/* Screenshot */}
          <div className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors pointer-events-none select-none">
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
            <div className="flex flex-col rounded px-2 py-1.5 transition-colors pointer-events-none select-none">
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
            className="relative inline-block pointer-events-auto"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="w-4 h-4 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              <Settings size={16} />
            </div>

            {/* Tooltip Content */}
            {isTooltipVisible && (
              <div
                ref={tooltipRef}
                className="absolute top-full left-0 mt-4 w-80 transform -translate-x-[calc(50%-12px)] z-[100] pointer-events-auto"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Add transparent bridge */}
                <div className="absolute -top-2 right-0 w-full h-2" />
                <div className="p-3 text-xs bg-background/80 backdrop-blur-md rounded-lg border border-border text-foreground shadow-lg">
                  <div className="space-y-4">
                    <h3 className="font-medium truncate select-none">
                      Keyboard Shortcuts
                    </h3>
                    <div className="space-y-3">
                      {/* Toggle Command */}
                      <div className="rounded px-2 py-1.5 transition-colors select-none">
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
                      <div className="rounded px-2 py-1.5 transition-colors select-none">
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
                        className={`rounded px-2 py-1.5 transition-colors select-none ${
                          screenshotCount === 0 ? "opacity-50" : ""
                        }`}
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
                      <div className="rounded px-2 py-1.5 transition-colors select-none">
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

                      {/* API Configuration Form */}
                      <div className="border-t border-border pt-3 mt-3">
                        <h3 className="font-medium truncate px-2 mb-3 select-none">
                          API Configuration
                        </h3>
                        <p className="text-xs text-muted-foreground mb-4 px-2">
                          Your API key is stored locally. Select your preferred
                          model.
                        </p>
                        <form
                          onSubmit={handleSubmit}
                          className="space-y-4 px-2"
                        >
                          <div>
                            <label
                              htmlFor="apiKey"
                              className="block text-xs font-medium text-foreground mb-3"
                            >
                              API Key
                            </label>
                            <Input
                              ref={inputRef}
                              type="password"
                              id="apiKey"
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              placeholder="Enter API key (e.g., sk-... or AIza...)"
                              autoComplete="off"
                              spellCheck="false"
                              className="text-xs h-8 select-text"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="model"
                              className="block text-xs font-medium text-foreground mb-3"
                            >
                              AI Model
                            </label>
                            {/* Make RadioGroup scrollable if needed */}
                            <RadioGroup
                              value={selectedModel}
                              onValueChange={setSelectedModel}
                              className="max-h-32 overflow-y-auto pr-1 space-y-2" // Limit height and add scroll
                            >
                              {MODEL_OPTIONS.map((model) => (
                                <div
                                  key={model.id}
                                  className="flex items-start space-x-2.5"
                                >
                                  <RadioGroupItem
                                    value={model.id}
                                    id={`model-${model.id}`}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1">
                                    <label
                                      htmlFor={`model-${model.id}`}
                                      className="text-xs font-medium text-foreground leading-tight"
                                    >
                                      {model.name}
                                      {model.default && (
                                        <span className="ml-1.5 text-[10px] bg-primary/60 px-1.5 py-0.5 rounded-full align-middle">
                                          Rec.
                                        </span>
                                      )}
                                    </label>
                                    <p className="text-[11px] text-muted-foreground leading-snug">
                                      {model.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </RadioGroup>
                          </div>

                          {error && (
                            <div className="text-destructive-foreground text-[11px] py-1.5 px-2 rounded bg-destructive/30 border border-destructive/50">
                              {error}
                            </div>
                          )}

                          {/* Remove Cancel button for simplicity or add specific logic */}
                          <div className="flex justify-end pt-1">
                            <Button
                              type="submit"
                              disabled={isLoading}
                              size="sm"
                              className="text-xs h-7"
                            >
                              {isLoading ? (
                                <>
                                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                "Save Config"
                              )}
                            </Button>
                          </div>
                        </form>
                      </div>

                      {/* Language Selector */}
                      <div className="border-t border-border pt-3 mt-3">
                        <h3 className="font-medium truncate px-2 mb-2 select-none">
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
