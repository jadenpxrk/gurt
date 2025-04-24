// ProcessingHelper.ts
import { BrowserWindow } from "electron";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { IProcessingHelperDeps } from "./main";
import OpenAI from "openai";
import { ScreenshotHelper } from "./ScreenshotHelper";
import { app } from "electron";
import fs from "node:fs";
import process from "process";

export class ProcessingHelper {
  private deps: IProcessingHelperDeps;
  private screenshotHelper: ScreenshotHelper;
  private isCurrentlyProcessing: boolean = false;

  // AbortControllers for API requests
  private currentProcessingAbortController: AbortController | null = null;
  private currentExtraProcessingAbortController: AbortController | null = null;

  constructor(deps: IProcessingHelperDeps) {
    this.deps = deps;
    this.screenshotHelper = deps.getScreenshotHelper();
  }

  private async waitForInitialization(
    mainWindow: BrowserWindow
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total

    while (attempts < maxAttempts) {
      const isInitialized = await mainWindow.webContents.executeJavaScript(
        "window.__IS_INITIALIZED__"
      );
      if (isInitialized) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    throw new Error("App failed to initialize after 5 seconds");
  }

  private async getLanguage(): Promise<string> {
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return "python";

    try {
      await this.waitForInitialization(mainWindow);
      const language = await mainWindow.webContents.executeJavaScript(
        "window.__LANGUAGE__"
      );

      if (
        typeof language !== "string" ||
        language === undefined ||
        language === null
      ) {
        console.warn("Language not properly initialized");
        return "python";
      }

      return language;
    } catch (error) {
      console.error("Error getting language:", error);
      return "python";
    }
  }

  public async processScreenshots(): Promise<void> {
    if (this.isCurrentlyProcessing) {
      console.log("Processing already in progress. Skipping duplicate call.");
      return;
    }

    this.isCurrentlyProcessing = true;
    const mainWindow = this.deps.getMainWindow();
    if (!mainWindow) return;

    // Credits check is bypassed - we always have enough credits

    try {
      const view = this.deps.getView();
      console.log("Processing screenshots in view:", view);

      if (view === "queue") {
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START);
        const screenshotQueue = this.screenshotHelper.getScreenshotQueue();
        console.log("Processing main queue screenshots:", screenshotQueue);
        if (screenshotQueue.length === 0) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS
          );
          return;
        }

        try {
          // Initialize AbortController
          this.currentProcessingAbortController = new AbortController();
          const { signal } = this.currentProcessingAbortController;

          const screenshots = await Promise.all(
            screenshotQueue.map(async (path) => ({
              path,
              preview: await this.screenshotHelper.getImagePreview(path),
              data: fs.readFileSync(path).toString("base64"),
            }))
          );

          const result = await this.processScreenshotsHelper(
            screenshots,
            signal
          );

          if (!result.success) {
            console.log("Processing failed:", result.error);
            if (result.error?.includes("OpenAI API key not found")) {
              mainWindow.webContents.send(
                this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
                "OpenAI API key not found in environment variables. Please set the OPEN_AI_API_KEY environment variable."
              );
            } else {
              mainWindow.webContents.send(
                this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
                result.error
              );
            }
            // Reset view back to queue on error
            console.log("Resetting view to queue due to error");
            this.deps.setView("queue");
            return;
          }

          // Only set view to solutions if processing succeeded
          console.log("Setting view to solutions after successful processing");
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
            result.data
          );
          this.deps.setView("solutions");
        } catch (error: any) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            error
          );
          console.error("Processing error:", error);
          if (error.message === "Request aborted") {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              "Processing was canceled by the user."
            );
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
              error.message || "Server error. Please try again."
            );
          }
          // Reset view back to queue on error
          console.log("Resetting view to queue due to error");
          this.deps.setView("queue");
        } finally {
          this.currentProcessingAbortController = null;
        }
      } else {
        // view == 'solutions'
        const extraScreenshotQueue =
          this.screenshotHelper.getExtraScreenshotQueue();
        console.log(
          "Processing extra queue screenshots:",
          extraScreenshotQueue
        );
        if (extraScreenshotQueue.length === 0) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS
          );
          return;
        }
        mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START);

        // Initialize AbortController
        this.currentExtraProcessingAbortController = new AbortController();
        const { signal } = this.currentExtraProcessingAbortController;

        try {
          const screenshots = await Promise.all(
            [
              ...this.screenshotHelper.getScreenshotQueue(),
              ...extraScreenshotQueue,
            ].map(async (path) => ({
              path,
              preview: await this.screenshotHelper.getImagePreview(path),
              data: fs.readFileSync(path).toString("base64"),
            }))
          );
          console.log(
            "Combined screenshots for processing:",
            screenshots.map((s) => s.path)
          );

          const result = await this.processExtraScreenshotsHelper(
            screenshots,
            signal
          );

          if (result.success) {
            this.deps.setHasDebugged(true);
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS,
              result.data
            );
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
              result.error
            );
          }
        } catch (error: any) {
          if (error.message === "Request aborted") {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
              "Extra processing was canceled by the user."
            );
          } else {
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
              error.message
            );
          }
        } finally {
          this.currentExtraProcessingAbortController = null;
        }
      }
    } finally {
      this.isCurrentlyProcessing = false; // Ensure flag is reset
      console.log("Processing finished. Resetting isCurrentlyProcessing flag.");
    }
  }

  private async processScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    const MAX_RETRIES = 0;
    let retryCount = 0;

    while (retryCount <= MAX_RETRIES) {
      try {
        const imageDataList = screenshots.map((screenshot) => screenshot.data);
        const mainWindow = this.deps.getMainWindow();
        const language = await this.getLanguage();
        let problemInfo = null;

        // Get configured provider and API key from environment
        const provider = process.env.API_PROVIDER || "openai";
        const apiKey = process.env.API_KEY;

        // Get model directly from config store via deps
        const model = await this.deps.getConfiguredModel();

        if (!apiKey) {
          throw new Error(
            "API key not found. Please configure it in settings."
          );
        }

        console.log(
          `Processing screenshots with provider: ${provider}, model: ${model}`
        );

        const base64Images = imageDataList.map(
          (data) => data // Keep the base64 string as is
        );

        let extractedProblemInfo = "";

        // Extract problem info using the configured provider
        if (provider === "openai") {
          const openai = new OpenAI({
            apiKey: apiKey,
            timeout: 300000,
            maxRetries: 3,
          });

          const imageMessages = base64Images.map((url) => ({
            type: "image_url" as const,
            image_url: { url: `data:image/png;base64,${url}` },
          }));

          const extractResponse = await openai.chat.completions.create(
            {
              model: model,
              messages: [
                {
                  role: "system",
                  content:
                    "You are an expert programming assistant that extracts problem information from screenshots.",
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Extract the programming problem description from these screenshots:",
                    },
                    ...imageMessages,
                  ],
                },
              ],
              max_tokens: 4000,
            },
            { signal }
          );
          extractedProblemInfo =
            extractResponse.choices[0].message.content || "";
        } else if (provider === "gemini") {
          const genAI = new GoogleGenerativeAI(apiKey);
          // Ensure the model selected supports vision input
          // Prepend models/ prefix for Gemini models
          const geminiModelId = model.startsWith("gemini-")
            ? `models/${model}`
            : model;
          const geminiModel = genAI.getGenerativeModel({
            model: geminiModelId,
          });

          const imageParts = base64Images.map((data) => ({
            inlineData: {
              mimeType: "image/png",
              data: data, // Pass the raw base64 data
            },
          }));

          // Use a simpler prompt for Gemini extraction
          const prompt =
            "Extract the programming problem description, requirements, examples, and constraints from these images.";

          // Check if the signal is aborted before making the call
          if (signal.aborted) throw new Error("Request aborted");

          // Add signal listener
          const abortHandler = () => {
            throw new Error("Request aborted");
          };
          signal.addEventListener("abort", abortHandler);

          try {
            // Pass the signal to the generateContent call if the SDK supports it directly
            // Note: As of late 2024, direct signal passing might not be supported in generateContent.
            // We rely on the pre-check and event listener for cancellation.
            const result = await geminiModel.generateContent([
              prompt,
              ...imageParts,
            ]);
            const response = await result.response;
            extractedProblemInfo = response.text();
          } finally {
            signal.removeEventListener("abort", abortHandler); // Clean up listener
          }
        } else {
          throw new Error(`Unsupported API provider: ${provider}`);
        }

        if (!extractedProblemInfo) {
          throw new Error(
            "Failed to extract problem information from the API."
          );
        }

        // Store problem info in AppState
        this.deps.setProblemInfo(extractedProblemInfo);

        // Send first success event
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED,
            extractedProblemInfo // Send the extracted info
          );

          // Generate solutions after successful extraction
          const solutionsResult = await this.generateSolutionsHelper(signal);
          if (solutionsResult.success) {
            // Clear any existing extra screenshots before transitioning to solutions view
            this.screenshotHelper.clearExtraScreenshotQueue();
            mainWindow.webContents.send(
              this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS,
              solutionsResult.data
            );
            return { success: true, data: solutionsResult.data };
          } else {
            throw new Error(
              solutionsResult.error || "Failed to generate solutions"
            );
          }
        }
      } catch (error: any) {
        // Log the full error for debugging
        console.error("Processing error details:", {
          message: error.message,
          code: error.code,
          response: error.response?.data,
          retryCount,
        });

        // If it's a cancellation or we've exhausted retries, return the error
        if (
          error.message === "Request aborted" || // Handle AbortController signal
          error.name === "AbortError" || // Handle potential Fetch AbortError
          retryCount >= MAX_RETRIES
        ) {
          return { success: false, error: error.message };
        }

        // Increment retry count and continue
        retryCount++;
      }
    }

    // If we get here, all retries failed
    return {
      success: false,
      error: "Failed to process after multiple attempts. Please try again.",
    };
  }

  private async generateSolutionsHelper(signal: AbortSignal) {
    try {
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();

      // Get configured provider, API key, and model
      const provider = process.env.API_PROVIDER || "openai";
      const apiKey = process.env.API_KEY;

      // Get model directly from config store via deps
      const model = await this.deps.getConfiguredModel();

      if (!apiKey) {
        throw new Error("API key not found. Please configure it in settings.");
      }

      if (!problemInfo) {
        throw new Error("No problem info available");
      }

      console.log(
        `Generating solutions with provider: ${provider}, model: ${model}, language: ${language}`
      );

      let solutionText = "";

      // Generate solution using the configured provider
      if (provider === "openai") {
        const openai = new OpenAI({
          apiKey: apiKey,
          timeout: 300000,
          maxRetries: 3,
        });

        const response = await openai.chat.completions.create(
          {
            model: model,
            messages: [
              {
                role: "system",
                content: `You are an expert programmer. Generate a solution in ${language}. Follow best practices and provide explanations. Include time/space complexity.`,
              },
              {
                role: "user",
                content: `Problem Description:\n${problemInfo}\n\nProvide a solution in ${language}. Include code, explanation, and complexity analysis.`,
              },
            ],
            max_tokens: 4000,
          },
          { signal }
        );
        solutionText = response.choices[0].message.content || "";
      } else if (provider === "gemini") {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Prepend models/ prefix for Gemini models
        const geminiModelId = model.startsWith("gemini-")
          ? `models/${model}`
          : model;
        const geminiModel = genAI.getGenerativeModel({ model: geminiModelId });

        // Gemini solution generation prompt (using extracted problemInfo)
        const promptLines = [
          `You are an expert programmer tasked with solving a problem in ${language}.`,
          `Problem Description:`, // Include the previously extracted problem info
          problemInfo,
          ``,
          `---`, // Separator
          `Your response MUST follow this exact structure, using Markdown headings:`,
          ``,
          `## Approach`,
          `**(Required)** First, explain your high-level plan and core logic BEFORE writing any code (1-3 sentences). Explain the strategy. Example: 'Use a hash map to store frequencies, then iterate...'.`,
          ``,
          `## Solution`,
          `Provide the complete, runnable code solution in ${language}. Use standard Markdown code blocks (\`\`\`${language}\n...\`\`\`). Add comments ONLY for non-obvious parts. Do NOT explain the code line-by-line here.`,
          ``,
          `## Complexity`,
          `Analyze the time and space complexity. State Time Complexity (e.g., O(n log n)) and Space Complexity (e.g., O(n)).`,
          ``,
          `---`, // Separator
          `Remember: The '## Approach' section explaining the overall strategy is mandatory and must come first. Adhere strictly to the requested format.`,
        ];
        const prompt = promptLines.join("\n");

        // Check if the signal is aborted before making the call
        if (signal.aborted) throw new Error("Request aborted");

        // Add signal listener
        const abortHandler = () => {
          throw new Error("Request aborted");
        };
        signal.addEventListener("abort", abortHandler);

        try {
          const result = await geminiModel.generateContent(prompt);
          const response = await result.response;
          solutionText = response.text();
        } finally {
          signal.removeEventListener("abort", abortHandler); // Clean up listener
        }
      } else {
        throw new Error(`Unsupported API provider: ${provider}`);
      }

      console.log("API response received for solution generation");

      // Parse the solution text into the expected format
      const solution = this.parseSolution(solutionText);

      console.log("Solution parsed successfully");

      return { success: true, data: solution };
    } catch (error: any) {
      // Keep existing generic error handling
      const mainWindow = this.deps.getMainWindow();
      console.error("Solution generation error:", {
        message: error.message,
        code: error.code,
        response: error.response?.data, // Note: Gemini SDK might structure errors differently
      });

      // Handle cancellation
      if (
        error.message === "Request aborted" || // Handle AbortController signal
        error.name === "AbortError" // Handle potential Fetch AbortError
      ) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Solution generation canceled."
          );
        }
        return { success: false, error: "Solution generation canceled." };
      }

      // Handle specific error cases (left as they were)
      if (error.code === "ETIMEDOUT" || error.response?.status === 504) {
        // Check for generic timeout
        // Cancel ongoing API requests
        this.cancelOngoingRequests();
        // Clear both screenshot queues
        this.deps.clearQueues();
        // Update view state to queue
        this.deps.setView("queue");
        // Notify renderer to switch view
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("reset-view");
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
            "Request timed out. The server took too long to respond. Please try again."
          );
        }
        return {
          success: false,
          error: "Request timed out. Please try again.",
        };
      }

      if (
        error.response?.data?.error?.includes(
          "Please close this window and re-enter a valid Open AI API key."
        )
      ) {
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.API_KEY_INVALID
          );
        }
        return { success: false, error: error.response.data.error };
      }

      // Default error
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
          error.message ||
            "Server error during solution generation. Please try again."
        );
      }
      // Reset view back to queue on error
      console.log("Resetting view to queue due to solution generation error");
      this.deps.setView("queue");
      return {
        success: false,
        error: error.message || "Unknown error during solution generation",
      };
    }
  }

  // Updated helper method to parse solution text using headings
  private parseSolution(solutionText: string | null): {
    code: string;
    thoughts: string[];
    time_complexity: string;
    space_complexity: string;
  } {
    if (!solutionText) {
      return {
        code: "No solution generated.",
        thoughts: ["Error: Empty response from API."],
        time_complexity: "N/A",
        space_complexity: "N/A",
      };
    }

    let code = "Code not found.";
    let approach = "Approach not specified.";
    let complexity = "Complexity analysis not found.";
    let timeComplexity = "Time complexity not specified";
    let spaceComplexity = "Space complexity not specified";

    // Try to extract content based on headings
    const approachMatch = solutionText.match(
      /##\s*Approach\b([\s\S]*?)(?:##\s*\w+|$)/i
    );
    if (approachMatch && approachMatch[1]) {
      approach = approachMatch[1].trim();
    }

    const solutionMatch = solutionText.match(
      /##\s*Solution\b[\s\S]*?\`\`\`.*?\n([\s\S]*?)\`\`\`/i
    );
    if (solutionMatch && solutionMatch[1]) {
      code = solutionMatch[1].trim();
    } else {
      // Fallback: Find first code block if no Solution heading
      const codeFallbackMatch = solutionText.match(
        /\`\`\`.*?\n([\s\S]*?)\`\`\`/
      );
      if (codeFallbackMatch && codeFallbackMatch[1]) {
        code = codeFallbackMatch[1].trim();
      }
    }

    const complexityMatch = solutionText.match(
      /##\s*Complexity\b([\s\S]*?)(?:##\s*\w+|$)/i
    );
    if (complexityMatch && complexityMatch[1]) {
      complexity = complexityMatch[1].trim();
      // Try extracting specific Time/Space from within the Complexity section
      const timeMatch = complexity.match(/Time Complexity:\s*(.*)/i);
      if (timeMatch && timeMatch[1]) {
        timeComplexity = timeMatch[1].trim();
      }
      const spaceMatch = complexity.match(/Space Complexity:\s*(.*)/i);
      if (spaceMatch && spaceMatch[1]) {
        spaceComplexity = spaceMatch[1].trim();
      }
      // Fallback if specific lines aren't found but complexity section exists
      if (
        timeComplexity === "Time complexity not specified" &&
        spaceComplexity === "Space complexity not specified"
      ) {
        const genericTimeMatch = complexity.match(/.*O\([^)]+\).*/i); // Find any Big O notation
        if (genericTimeMatch) {
          timeComplexity = genericTimeMatch[0]; // Use the whole line containing O() as a fallback
          spaceComplexity = "(extracted from Complexity section)";
        }
      }
    } else {
      // Fallback: Try original regex if no Complexity heading
      const extractOldComplexity = (text: string, type: "time" | "space") => {
        const regex = new RegExp(
          `${type}\\s*complexity.*?[OΘΩ]\\([^)]+\\)`,
          "i"
        );
        const match = text.match(regex);
        return match
          ? match[0]
          : `${
              type.charAt(0).toUpperCase() + type.slice(1)
            } complexity not specified`;
      };
      timeComplexity = extractOldComplexity(solutionText, "time");
      spaceComplexity = extractOldComplexity(solutionText, "space");
    }

    // Use Approach as the primary thought, or fallback to text before code
    let thoughts = [approach];
    if (approach === "Approach not specified.") {
      const firstCodeBlockIndex = solutionText.indexOf("```");
      if (firstCodeBlockIndex > 0) {
        thoughts = [solutionText.substring(0, firstCodeBlockIndex).trim()];
      } else if (code === "Code not found.") {
        // If no code and no approach, use the whole text as thought
        thoughts = [solutionText.trim()];
      }
    }

    return {
      code: code,
      thoughts: thoughts.filter((t) => t), // Filter out empty thoughts
      time_complexity: timeComplexity,
      space_complexity: spaceComplexity,
    };
  }

  private async processExtraScreenshotsHelper(
    screenshots: Array<{ path: string; data: string }>,
    signal: AbortSignal
  ) {
    try {
      const imageDataList = screenshots.map((screenshot) => screenshot.data);
      const problemInfo = this.deps.getProblemInfo();
      const language = await this.getLanguage();

      if (!problemInfo) {
        throw new Error("No problem info available for debugging context.");
      }

      // Get configured provider, API key, and model
      const provider = process.env.API_PROVIDER || "openai";
      const apiKey = process.env.API_KEY;
      const model = await this.deps.getConfiguredModel(); // Use configured model

      if (!apiKey) {
        throw new Error("API key not found. Please configure it in settings.");
      }

      console.log(
        `[Debug Helper] Processing extra screenshots (debug) with provider: ${provider}, model: ${model}, language: ${language}`
      );

      const base64Images = imageDataList.map(
        (data) => data // Keep the base64 string as is
      );

      let debugResponseText = "";

      // Define a prompt for debugging/refinement
      const debugPrompt = `You are an expert programming assistant helping debug or refine a solution.

Original Problem Description:
${problemInfo}

Here are screenshots related to the problem (these may include the original problem statement and additional context/errors provided later):
[Images will be inserted here by the API call]

Based on the original problem and ALL the provided screenshots, provide your response in the following format:

## Approach
Analyze the situation (errors shown, refinement needed) and explain your debugging/refinement strategy in 2-3 sentences.

## Solution
Provide the complete, refined code solution in ${language}. Use standard Markdown code blocks (\`\`\`${language}\\n...\\n\`\`\`).
Add comments ONLY for non-obvious parts.

## Complexity
State the Time Complexity and Space Complexity of the refined solution.

Note: This format must be followed exactly as it will be parsed automatically.`;

      if (provider === "openai") {
        const openai = new OpenAI({
          apiKey: apiKey,
          timeout: 300000,
          maxRetries: 3,
        });

        const imageMessages = base64Images.map((url) => ({
          type: "image_url" as const,
          image_url: { url: `data:image/png;base64,${url}` },
        }));

        const response = await openai.chat.completions.create(
          {
            model: model, // Use the configured model
            messages: [
              {
                role: "system",
                content:
                  "You are an expert programming assistant specialized in debugging and code refinement.",
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: debugPrompt.replace(
                      "[Images will be inserted here by the API call]",
                      ""
                    ),
                  }, // Remove placeholder text
                  ...imageMessages,
                ],
              },
            ],
            max_tokens: 4000,
          },
          { signal }
        );
        debugResponseText = response.choices[0].message.content || "";
      } else if (provider === "gemini") {
        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiModelId = model.startsWith("gemini-")
          ? `models/${model}`
          : model; // Prepend models/ if needed
        const geminiModel = genAI.getGenerativeModel({ model: geminiModelId });

        const imageParts = base64Images.map((data) => ({
          inlineData: { mimeType: "image/png", data: data },
        }));

        // Check if signal aborted before call
        if (signal.aborted) throw new Error("Request aborted");
        const abortHandler = () => {
          throw new Error("Request aborted");
        };
        signal.addEventListener("abort", abortHandler);

        try {
          console.log(`[Debug Helper] Attempting ${provider} API call...`);
          // Pass prompt and images
          const result = await geminiModel.generateContent([
            debugPrompt.replace(
              "[Images will be inserted here by the API call]",
              ""
            ), // Remove placeholder text
            ...imageParts,
          ]);
          const response = await result.response;
          debugResponseText = response.text();
        } finally {
          signal.removeEventListener("abort", abortHandler);
        }
      } else {
        console.log("[Debug Helper] Unsupported provider.");
        throw new Error(`Unsupported API provider: ${provider}`);
      }

      console.log(
        "[Debug Helper] API call finished. Response text length:",
        debugResponseText.length
      );
      console.log("[Debug Helper] Raw response:", debugResponseText);

      // Parse the response using the same format as initial solutions
      const parsedSolution = this.parseSolution(debugResponseText);
      console.log("[Debug Helper] Parsed solution:", parsedSolution);

      return { success: true, data: parsedSolution };
    } catch (error: any) {
      console.error("[Debug Helper] Error caught:", {
        message: error.message,
        name: error.name,
        code: error.code,
        stack: error.stack, // Include stack trace for more context
      });
      const mainWindow = this.deps.getMainWindow();

      // Handle cancellation first
      if (
        error.message === "Request aborted" || // Handle AbortController signal
        error.name === "AbortError" // Handle potential Fetch AbortError
      ) {
        return {
          success: false,
          error: "Debug processing was canceled by the user.",
        };
      }

      // Handle timeout (example, adjust if needed based on SDK errors)
      if (
        error.code === "ETIMEDOUT" ||
        error.message.toLowerCase().includes("timeout")
      ) {
        // Cancel ongoing API requests
        this.cancelOngoingRequests();
        // Clear both screenshot queues
        this.deps.clearQueues();
        // Update view state to queue
        this.deps.setView("queue");
        // Notify renderer to switch view
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("reset-view");
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.DEBUG_ERROR,
            "Debug request timed out. Please try again."
          );
        }
        return {
          success: false,
          error: "Debug request timed out. Please try again.",
        };
      }

      // Handle invalid API key specifically (example based on OpenAI structure)
      if (
        error.response?.data?.error?.includes(
          "Please close this window and re-enter a valid Open AI API key."
        )
      ) {
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.API_KEY_INVALID
          );
        }
        return {
          success: false,
          error: error.response?.data?.error || "Invalid API Key detected.",
        };
      }
      // Add specific handling for Gemini API key errors if known
      if (error.message?.includes("API key not valid")) {
        if (mainWindow) {
          mainWindow.webContents.send(
            this.deps.PROCESSING_EVENTS.API_KEY_INVALID
          );
        }
        return {
          success: false,
          error: "Invalid API Key for Gemini. Please check settings.",
        };
      }

      // Generic error
      console.error("[Debug Helper] Returning generic error.");
      return { success: false, error: error.message };
    }
  }

  public cancelOngoingRequests(): void {
    let wasCancelled = false;

    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort();
      this.currentProcessingAbortController = null;
      wasCancelled = true;
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort();
      this.currentExtraProcessingAbortController = null;
      wasCancelled = true;
    }

    // Reset hasDebugged flag
    this.deps.setHasDebugged(false);

    // Clear any pending state
    this.deps.setProblemInfo(null);

    const mainWindow = this.deps.getMainWindow();
    if (wasCancelled && mainWindow && !mainWindow.isDestroyed()) {
      // Send a clear message that processing was cancelled
      mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
    }
  }

  public cancelProcessing(): void {
    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort();
      this.currentProcessingAbortController = null;
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort();
      this.currentExtraProcessingAbortController = null;
    }
  }

  public isProcessing(): boolean {
    return this.isCurrentlyProcessing;
  }
}
