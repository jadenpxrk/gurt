import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import React, { useEffect, useRef, useState } from "react";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Loader2 } from "lucide-react";

/**
 * Modal component for entering the API key and selecting a model
 */
interface APIKeyModalProps {
  trigger: HTMLElement | null;
  onClose: () => void;
}

// Define available model options
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

const APIKeyModal: React.FC<APIKeyModalProps> = ({ trigger, onClose }) => {
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState(
    () => MODEL_OPTIONS.find((model) => model.default)?.id || "o3"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Load current API key and model when the modal opens
  useEffect(() => {
    const loadCurrentConfig = async () => {
      try {
        const response = await window.electronAPI.getApiConfig();
        if (response.success && response.apiKey) {
          setApiKey(response.apiKey);
          if (response.model) {
            setSelectedModel(response.model);
          }
        }
      } catch (error) {
        console.error("Error loading current API configuration:", error);
      }
    };

    loadCurrentConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

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
        onClose();
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

  return (
    <div className="absolute top-full left-0 mt-2 transform translate-x-[calc(14px)] z-50 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center justify-center">
        <div
          ref={modalRef}
          className="bg-background/80 backdrop-blur-md rounded-lg p-6 m-4 max-w-md w-full border border-border overflow-y-auto"
        >
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Configure API Settings
          </h2>

          <p className="text-muted-foreground mb-6 text-sm">
            Your API key is required to use the AI features. It will be stored
            locally on your device and never sent to our servers.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="apiKey"
                className="block text-sm font-medium text-foreground mb-2"
              >
                API Key
              </label>
              <Input
                ref={inputRef}
                type="password"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key (e.g., sk-... or AIza...)"
                autoComplete="off"
                spellCheck="false"
              />
            </div>

            <div>
              <label
                htmlFor="model"
                className="block text-sm font-medium text-foreground mb-2"
              >
                AI Model
              </label>
              <RadioGroup
                value={selectedModel}
                onValueChange={setSelectedModel}
              >
                {MODEL_OPTIONS.map((model) => (
                  <div key={model.id} className="flex items-start space-x-3">
                    <RadioGroupItem value={model.id} id={`model-${model.id}`} />
                    <div>
                      <label
                        htmlFor={`model-${model.id}`}
                        className="text-sm font-medium text-foreground"
                      >
                        {model.name}
                        {model.default && (
                          <span className="ml-2 text-xs bg-primary/60 px-2 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {model.description}
                      </p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {error && (
              <div className="text-destructive-foreground text-sm py-2 px-3 rounded bg-destructive/30 border border-destructive/50">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Configuration"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default APIKeyModal;
