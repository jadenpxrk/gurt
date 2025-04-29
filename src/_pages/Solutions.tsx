// Solutions.tsx
import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { COMMAND_KEY } from "../utils/platform";
import Debug from "./Debug";
import { ProblemStatementData } from "../types/solutions";
import ReactMarkdown from "react-markdown";
import ScreenshotQueue from "../components/Queue/ScreenshotQueue";
import SolutionCommands from "../components/Solutions/SolutionCommands";
import rehypePrism from "rehype-prism-plus";
import remarkGfm from "remark-gfm";
import { useToast } from "../contexts/toast";

export const ContentSection = ({
  title,
  content,
  isLoading,
}: {
  title: string;
  content: React.ReactNode;
  isLoading: boolean;
}) => (
  <div className="space-y-2">
    <h2 className="text-sm font-medium text-foreground tracking-wide">
      {title}
    </h2>
    {isLoading ? (
      <div className="mt-4 flex">
        <p className="text-xs text-muted-foreground animate-pulse">
          Extracting problem statement...
        </p>
      </div>
    ) : (
      <div className="text-sm text-foreground w-full">{content}</div>
    )}
  </div>
);

// Component to render markdown content
const MarkdownRenderer = ({ content }: { content: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypePrism]}
    components={{
      h1: ({ node, ...props }) => (
        <h1 className="text-lg font-bold mt-4 mb-2" {...props} />
      ),
      h2: ({ node, ...props }) => (
        <h2 className="text-md font-bold mt-3 mb-2" {...props} />
      ),
      h3: ({ node, ...props }) => (
        <h3 className="text-sm font-bold mt-2 mb-1" {...props} />
      ),
      p: ({ node, ...props }) => <p className="mb-2" {...props} />,
      ul: ({ node, ...props }) => (
        <ul className="list-disc ml-4 mb-2" {...props} />
      ),
      ol: ({ node, ...props }) => (
        <ol className="list-decimal ml-4 mb-2" {...props} />
      ),
      li: ({ node, ...props }) => <li className="mb-1" {...props} />,
      table: ({ node, ...props }) => (
        <div className="overflow-x-auto my-2">
          <table className="min-w-full border" {...props} />
        </div>
      ),
      thead: ({ node, ...props }) => <thead className="bg-muted" {...props} />,
      tbody: ({ node, ...props }) => <tbody {...props} />,
      tr: ({ node, ...props }) => <tr className="border-b" {...props} />,
      th: ({ node, ...props }) => (
        <th className="px-4 py-2 text-left text-foreground" {...props} />
      ),
      td: ({ node, ...props }) => (
        <td className="px-4 py-2 border-r last:border-r-0" {...props} />
      ),
      pre: ({ node, ...props }) => (
        <pre
          className="my-2 overflow-x-auto rounded border p-3 text-muted-foreground"
          {...props}
        />
      ),
      code: ({ node, className, children, ...props }) => {
        const match = /language-(\w+)/.exec(className || "");
        return match ? (
          <code className={className} {...props}>
            {children}
          </code>
        ) : (
          <code
            className="relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm"
            style={{
              backgroundColor: "hsl(var(--background) / 0.8)",
              color: "hsl(var(--muted-foreground))",
            }}
            {...props}
          >
            {children}
          </code>
        );
      },
    }}
  >
    {content}
  </ReactMarkdown>
);

const SolutionSection = ({
  title,
  content,
  isLoading,
  currentLanguage,
}: {
  title: string;
  content: React.ReactNode;
  isLoading: boolean;
  currentLanguage: string;
}) => (
  <div className="space-y-2">
    <h2 className="text-sm font-medium text-foreground tracking-wide">
      {title}
    </h2>
    {isLoading ? (
      <div className="space-y-1.5">
        <div className="mt-4 flex">
          <p className="text-xs text-muted-foreground animate-pulse">
            Loading solutions...
          </p>
        </div>
      </div>
    ) : (
      <div className="w-full">
        <pre
          className="p-4 rounded text-sm whitespace-pre-wrap break-all overflow-x-auto border"
          style={{
            color: "hsl(var(--muted-foreground))",
          }}
        >
          <code
            className={`language-${
              currentLanguage == "golang" ? "go" : currentLanguage
            }`}
          >
            {content}
          </code>
        </pre>
      </div>
    )}
  </div>
);

export const ComplexitySection = ({
  timeComplexity,
  spaceComplexity,
  isLoading,
}: {
  timeComplexity: string | null;
  spaceComplexity: string | null;
  isLoading: boolean;
}) => (
  <div className="space-y-2">
    <h2 className="text-sm font-medium text-foreground tracking-wide">
      Complexity
    </h2>
    {isLoading ? (
      <p className="text-xs text-muted-foreground animate-pulse">
        Calculating complexity...
      </p>
    ) : (
      <div className="space-y-1">
        <div className="flex items-start gap-2 text-sm text-foreground">
          <div className="w-1 h-1 rounded-full bg-primary mt-2 shrink-0" />
          <div>
            <strong>Time:</strong> {timeComplexity}
          </div>
        </div>
        <div className="flex items-start gap-2 text-sm text-foreground">
          <div className="w-1 h-1 rounded-full bg-primary mt-2 shrink-0" />
          <div>
            <strong>Space:</strong> {spaceComplexity}
          </div>
        </div>
      </div>
    )}
  </div>
);

export interface SolutionsProps {
  setView: (view: "queue" | "solutions" | "debug") => void;
  currentLanguage: string;
  setLanguage: (language: string) => void;
}
const Solutions: React.FC<SolutionsProps> = ({
  setView,
  currentLanguage,
  setLanguage,
}) => {
  const queryClient = useQueryClient();
  const [showDebugView, setShowDebugView] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const [debugProcessing, setDebugProcessing] = useState(false);
  const [problemStatementData, setProblemStatementData] =
    useState<ProblemStatementData | null>(null);
  const [solutionData, setSolutionData] = useState<string | null>(null);
  const [thoughtsData, setThoughtsData] = useState<string[] | null>(null);
  const [timeComplexityData, setTimeComplexityData] = useState<string | null>(
    null
  );
  const [spaceComplexityData, setSpaceComplexityData] = useState<string | null>(
    null
  );

  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipHeight, setTooltipHeight] = useState(0);

  const [isResetting, setIsResetting] = useState(false);

  interface Screenshot {
    id: string;
    path: string;
    preview: string;
    timestamp: number;
  }

  const [extraScreenshots, setExtraScreenshots] = useState<Screenshot[]>([]);

  useEffect(() => {
    const fetchScreenshots = async () => {
      try {
        const existing = await window.electronAPI.getScreenshots();
        console.log("Raw screenshot data:", existing);
        const screenshots = (Array.isArray(existing) ? existing : []).map(
          (p) => ({
            id: p.path,
            path: p.path,
            preview: p.preview,
            timestamp: Date.now(),
          })
        );
        console.log("Processed screenshots:", screenshots);
        setExtraScreenshots(screenshots);
      } catch (error) {
        console.error("Error loading extra screenshots:", error);
        setExtraScreenshots([]);
      }
    };

    fetchScreenshots();
  }, [solutionData]);

  const { showToast } = useToast();

  useEffect(() => {
    // Height update logic
    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight;
        const contentWidth = contentRef.current.scrollWidth;
        if (isTooltipVisible) {
          contentHeight += tooltipHeight;
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight,
        });
      }
    };

    // Initialize resize observer
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    updateDimensions();

    // Set up event listeners
    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(async () => {
        try {
          const existing = await window.electronAPI.getScreenshots();
          const screenshots = (Array.isArray(existing) ? existing : []).map(
            (p) => ({
              id: p.path,
              path: p.path,
              preview: p.preview,
              timestamp: Date.now(),
            })
          );
          setExtraScreenshots(screenshots);
        } catch (error) {
          console.error("Error loading extra screenshots:", error);
        }
      }),
      window.electronAPI.onResetView(() => {
        // Set resetting state first
        setIsResetting(true);

        // Remove queries
        queryClient.removeQueries({
          queryKey: ["solution"],
        });
        queryClient.removeQueries({
          queryKey: ["new_solution"],
        });

        // Reset screenshots
        setExtraScreenshots([]);

        // Reset debug view flag
        setShowDebugView(false);

        // After a small delay, clear the resetting state
        setTimeout(() => {
          setIsResetting(false);
        }, 0);
      }),
      window.electronAPI.onSolutionStart(() => {
        // Every time processing starts, reset relevant states
        setSolutionData(null);
        setThoughtsData(null);
        setTimeComplexityData(null);
        setSpaceComplexityData(null);
      }),
      window.electronAPI.onProblemExtracted((data) => {
        queryClient.setQueryData(["problem_statement"], data);
      }),
      //if there was an error processing the initial solution
      window.electronAPI.onSolutionError((error: string) => {
        showToast("Processing Failed", error, "error");
        // Reset solutions in the cache (even though this shouldn't ever happen) and complexities to previous states
        const solution = queryClient.getQueryData(["solution"]) as {
          code: string;
          thoughts: string[];
          time_complexity: string;
          space_complexity: string;
        } | null;
        if (!solution) {
          setView("queue");
        }
        setSolutionData(solution?.code || null);
        setThoughtsData(solution?.thoughts || null);
        setTimeComplexityData(solution?.time_complexity || null);
        setSpaceComplexityData(solution?.space_complexity || null);
        console.error("Processing error:", error);
      }),
      //when the initial solution is generated, we'll set the solution data to that
      window.electronAPI.onSolutionSuccess((data) => {
        if (!data) {
          console.warn("Received empty or invalid solution data");
          return;
        }
        console.log({ data });
        const solutionData = {
          code: data.code,
          thoughts: data.thoughts,
          time_complexity: data.time_complexity,
          space_complexity: data.space_complexity,
        };

        queryClient.setQueryData(["solution"], solutionData);
        setSolutionData(solutionData.code || null);
        setThoughtsData(solutionData.thoughts || null);
        setTimeComplexityData(solutionData.time_complexity || null);
        setSpaceComplexityData(solutionData.space_complexity || null);

        // Fetch latest screenshots when solution is successful
        const fetchScreenshots = async () => {
          try {
            const existing = await window.electronAPI.getScreenshots();
            const screenshots =
              existing.previews?.map((p) => ({
                id: p.path,
                path: p.path,
                preview: p.preview,
                timestamp: Date.now(),
              })) || [];
            setExtraScreenshots(screenshots);
          } catch (error) {
            console.error("Error loading extra screenshots:", error);
            setExtraScreenshots([]);
          }
        };
        fetchScreenshots();
      }),
      // Listener to trigger showing the Debug view
      window.electronAPI.onDebugSuccess((data) => {
        console.log("[Solutions] Debug success, switching to debug view");
        setShowDebugView(true);
        setDebugProcessing(false);

        // Store debug data in cache
        queryClient.setQueryData(["debug_solution"], {
          code: data.code,
          thoughts: data.thoughts,
          time_complexity: data.time_complexity,
          space_complexity: data.space_complexity,
        });
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          "No Screenshots",
          "There are no extra screenshots to process.",
          "neutral"
        );
      }),
    ];

    return () => {
      resizeObserver.disconnect();
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [isTooltipVisible, tooltipHeight]);

  useEffect(() => {
    setProblemStatementData(
      queryClient.getQueryData(["problem_statement"]) || null
    );
    setSolutionData(queryClient.getQueryData(["solution"]) || null);

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query.queryKey[0] === "problem_statement") {
        setProblemStatementData(
          queryClient.getQueryData(["problem_statement"]) || null
        );
      }
      if (event?.query.queryKey[0] === "solution") {
        const solution = queryClient.getQueryData(["solution"]) as {
          code: string;
          thoughts: string[];
          time_complexity: string;
          space_complexity: string;
        } | null;

        setSolutionData(solution?.code ?? null);
        setThoughtsData(solution?.thoughts ?? null);
        setTimeComplexityData(solution?.time_complexity ?? null);
        setSpaceComplexityData(solution?.space_complexity ?? null);
      }
    });
    return () => unsubscribe();
  }, [queryClient]);

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible);
    setTooltipHeight(height);
  };

  const handleDeleteExtraScreenshot = async (index: number) => {
    const screenshotToDelete = extraScreenshots[index];

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      );

      if (response.success) {
        // Fetch and update screenshots after successful deletion
        const existing = await window.electronAPI.getScreenshots();
        const screenshots = (Array.isArray(existing) ? existing : []).map(
          (p) => ({
            id: p.path,
            path: p.path,
            preview: p.preview,
            timestamp: Date.now(),
          })
        );
        setExtraScreenshots(screenshots);
      } else {
        console.error("Failed to delete extra screenshot:", response.error);
        showToast("Error", "Failed to delete the screenshot", "error");
      }
    } catch (error) {
      console.error("Error deleting extra screenshot:", error);
      showToast("Error", "Failed to delete the screenshot", "error");
    }
  };

  return (
    <>
      {!isResetting && showDebugView ? (
        <Debug
          isProcessing={debugProcessing}
          setIsProcessing={setDebugProcessing}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />
      ) : (
        <div ref={contentRef} className="relative space-y-3 px-4 py-3">
          {/* Conditionally render the screenshot queue if solutionData is available */}
          {solutionData && (
            <div className="bg-transparent w-fit">
              <div className="pb-3">
                <div className="space-y-3 w-fit">
                  <ScreenshotQueue
                    isLoading={debugProcessing}
                    screenshots={extraScreenshots}
                    onDeleteScreenshot={handleDeleteExtraScreenshot}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navbar of commands with the SolutionsHelper */}
          <div className="relative z-10">
            <SolutionCommands
              onTooltipVisibilityChange={handleTooltipVisibilityChange}
              isProcessing={!problemStatementData || !solutionData}
              extraScreenshots={extraScreenshots}
              currentLanguage={currentLanguage}
              setLanguage={setLanguage}
            />
          </div>

          {/* Main Content - Modified width constraints */}
          <div className="w-full text-sm text-foreground rounded-md select-none bg-background/80 backdrop-blur-md">
            <div className="rounded-lg overflow-hidden">
              <div className="px-4 py-3 space-y-4 max-w-full">
                {!solutionData && (
                  <>
                    <ContentSection
                      title="Problem Statement"
                      content={
                        problemStatementData?.problem_statement ? (
                          <MarkdownRenderer
                            content={problemStatementData.problem_statement}
                          />
                        ) : null
                      }
                      isLoading={!problemStatementData}
                    />
                    {problemStatementData && (
                      <div className="mt-4 flex">
                        <p className="text-xs text-muted-foreground animate-pulse">
                          Generating solutions...
                        </p>
                      </div>
                    )}
                  </>
                )}

                {solutionData && (
                  <>
                    <ContentSection
                      title={`My Thoughts (${COMMAND_KEY} + Arrow keys to scroll)`}
                      content={
                        thoughtsData && (
                          <div className="space-y-3">
                            {thoughtsData.map((thought, index) => (
                              <div
                                key={index}
                                className="text-muted-foreground"
                              >
                                {thought}
                              </div>
                            ))}
                          </div>
                        )
                      }
                      isLoading={!thoughtsData}
                    />

                    <SolutionSection
                      title="Solution"
                      content={solutionData}
                      isLoading={!solutionData}
                      currentLanguage={currentLanguage}
                    />

                    <ComplexitySection
                      timeComplexity={timeComplexityData}
                      spaceComplexity={spaceComplexityData}
                      isLoading={!timeComplexityData || !spaceComplexityData}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Solutions;
