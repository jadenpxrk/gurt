import { ComplexitySection, ContentSection } from "./Solutions";
import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Screenshot } from "../types/screenshots";
import ScreenshotQueue from "../components/Queue/ScreenshotQueue";
import SolutionCommands from "../components/Solutions/SolutionCommands";
import { useToast } from "../contexts/toast";

const CodeSection = ({
  title,
  code,
  isLoading,
  currentLanguage,
}: {
  title: string;
  code: React.ReactNode;
  isLoading: boolean;
  currentLanguage: string;
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-foreground tracking-wide"></h2>
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
        {/* Use Shadcn variables for Debug code block styling */}
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
            {code}
          </code>
        </pre>
      </div>
    )}
  </div>
);

async function fetchScreenshots(): Promise<Screenshot[]> {
  try {
    const existing = await window.electronAPI.getScreenshots();
    console.log("Raw screenshot data in Debug:", existing);
    return (Array.isArray(existing) ? existing : []).map((p) => ({
      id: p.path,
      path: p.path,
      preview: p.preview,
      timestamp: Date.now(),
    }));
  } catch (error) {
    console.error("Error loading screenshots:", error);
    throw error;
  }
}

interface DebugProps {
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
  currentLanguage: string;
  setLanguage: (language: string) => void;
}

const Debug: React.FC<DebugProps> = ({
  isProcessing,
  setIsProcessing,
  currentLanguage,
  setLanguage,
}) => {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipHeight, setTooltipHeight] = useState(0);
  const { showToast } = useToast();

  const { data: screenshots = [], refetch } = useQuery<Screenshot[]>({
    queryKey: ["screenshots"],
    queryFn: fetchScreenshots,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const [newCode, setNewCode] = useState<string | null>(null);
  const [thoughtsData, setThoughtsData] = useState<string[] | null>(null);
  const [timeComplexityData, setTimeComplexityData] = useState<string | null>(
    null
  );
  const [spaceComplexityData, setSpaceComplexityData] = useState<string | null>(
    null
  );

  const queryClient = useQueryClient();
  const contentRef = useRef<HTMLDivElement>(null);

  // Set window non-interactive when Debug view mounts
  useEffect(() => {
    console.log("Debug view mounted, making window non-interactive initially.");
    window.electronAPI.setIgnoreMouseEvents();
    // No cleanup needed here, as SolutionCommands handles it on unmount
  }, []);

  useEffect(() => {
    // Initial load from cache (if available on component mount)
    const initialNewSolution = queryClient.getQueryData(["new_solution"]) as {
      new_code: string;
      thoughts: string[];
      time_complexity: string;
      space_complexity: string;
    } | null;

    if (initialNewSolution) {
      setNewCode(initialNewSolution.new_code || null);
      setThoughtsData(initialNewSolution.thoughts || null);
      setTimeComplexityData(initialNewSolution.time_complexity || null);
      setSpaceComplexityData(initialNewSolution.space_complexity || null);
      setIsProcessing(false);
    }

    // Subscribe to cache changes for new_solution
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event?.type === "updated" &&
        event.query.queryKey[0] === "new_solution" &&
        event.query.state.status === "success" // Ensure data is successfully fetched/updated
      ) {
        const newSolutionData = event.query.state.data as {
          new_code: string;
          thoughts: string[];
          time_complexity: string;
          space_complexity: string;
        } | null;

        if (newSolutionData) {
          setNewCode(newSolutionData.new_code || null);
          setThoughtsData(newSolutionData.thoughts || null);
          setTimeComplexityData(newSolutionData.time_complexity || null);
          setSpaceComplexityData(newSolutionData.space_complexity || null);
          setIsProcessing(false); // Stop loading AFTER state is updated
        }
      }
    });

    const cleanupFunctions = [
      // Listeners specific to the Debug view
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onDebugStart(() => {
        setIsProcessing(true);
        // Clear previous debug data on new start
        setNewCode(null);
        setThoughtsData(null);
        setTimeComplexityData(null);
        setSpaceComplexityData(null);
        // Also clear the cache for the new solution when starting
        queryClient.setQueryData(["new_solution"], null);
      }),
      window.electronAPI.onDebugSuccess((data) => {
        // Update the cache; the subscription below will handle state updates
        queryClient.setQueryData(["new_solution"], data);
        // Stop loading immediately after successful data reception and cache update
        setIsProcessing(false);
      }),
      window.electronAPI.onDebugError((error: string) => {
        showToast(
          "Processing Failed",
          "There was an error debugging your code.",
          "error"
        );
        // Ensure loading stops on error
        setIsProcessing(false);
        console.error("Processing error:", error);
      }),
      unsubscribe, // Add unsubscribe to cleanup
    ];

    // Set up resize observer
    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight;
        const contentWidth = contentRef.current.scrollWidth;
        if (tooltipVisible) {
          contentHeight += tooltipHeight;
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    updateDimensions();

    return () => {
      resizeObserver.disconnect();
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [queryClient, setIsProcessing, refetch]);

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setTooltipVisible(visible);
    setTooltipHeight(height);
  };

  const handleDeleteExtraScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index];

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      );

      if (response.success) {
        refetch();
      } else {
        console.error("Failed to delete extra screenshot:", response.error);
      }
    } catch (error) {
      console.error("Error deleting extra screenshot:", error);
    }
  };

  return (
    <div ref={contentRef} className="relative space-y-3 px-4 py-3">
      {/* Conditionally render the screenshot queue */}
      <div className="bg-transparent w-fit">
        <div className="pb-3">
          <div className="space-y-3 w-fit">
            <ScreenshotQueue
              screenshots={screenshots}
              onDeleteScreenshot={handleDeleteExtraScreenshot}
              isLoading={isProcessing}
            />
          </div>
        </div>
      </div>

      {/* Navbar of commands with the tooltip */}
      <div className="relative z-10">
        <SolutionCommands
          screenshots={screenshots}
          onTooltipVisibilityChange={handleTooltipVisibilityChange}
          isProcessing={isProcessing}
          extraScreenshots={screenshots}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />
      </div>

      {/* Main Content */}
      <div className="w-full text-sm text-foreground rounded-md select-none bg-background/80 backdrop-blur-md">
        <div className="rounded-lg overflow-hidden">
          <div className="px-4 py-3 space-y-4">
            {/* Thoughts Section */}
            <ContentSection
              title="What I Changed"
              content={
                thoughtsData && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      {thoughtsData.map((thought, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-primary mt-2 shrink-0" />
                          <div>{thought}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
              isLoading={!thoughtsData}
            />

            {/* Code Section */}
            <CodeSection
              title="Solution"
              code={newCode}
              isLoading={!newCode}
              currentLanguage={currentLanguage}
            />

            {/* Complexity Section */}
            <ComplexitySection
              timeComplexity={timeComplexityData}
              spaceComplexity={spaceComplexityData}
              isLoading={!timeComplexityData || !spaceComplexityData}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Debug;
