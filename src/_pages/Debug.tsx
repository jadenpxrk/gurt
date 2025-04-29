import { ComplexitySection, ContentSection } from "./Solutions";
import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Screenshot } from "../types/screenshots";
import ScreenshotQueue from "../components/Queue/ScreenshotQueue";
import SolutionCommands from "../components/Solutions/SolutionCommands";
import { useToast } from "../contexts/toast";

interface DebugSolutionData {
  code: string;
  thoughts: string[];
  time_complexity: string;
  space_complexity: string;
}

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
    <h2 className="text-sm font-medium text-foreground tracking-wide">
      {title}
    </h2>
    {isLoading ? (
      <div className="space-y-1.5">
        <div className="mt-4 flex">
          <p className="text-xs text-muted-foreground animate-pulse">
            Loading solution...
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
              currentLanguage === "golang" ? "go" : currentLanguage
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
      path: p.path,
      preview: p.preview,
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
  const queryClient = useQueryClient();

  // Get cached debug data with proper typing
  const cachedDebugData = queryClient.getQueryData<DebugSolutionData>([
    "debug_solution",
  ]);

  const [newCode, setNewCode] = useState<string | null>(
    cachedDebugData?.code || null
  );
  const [thoughtsData, setThoughtsData] = useState<string[] | null>(
    cachedDebugData?.thoughts || null
  );
  const [timeComplexityData, setTimeComplexityData] = useState<string | null>(
    cachedDebugData?.time_complexity || null
  );
  const [spaceComplexityData, setSpaceComplexityData] = useState<string | null>(
    cachedDebugData?.space_complexity || null
  );

  const { data: screenshots = [], refetch } = useQuery<Screenshot[]>({
    queryKey: ["screenshots"],
    queryFn: fetchScreenshots,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const contentRef = useRef<HTMLDivElement>(null);

  // Add debug logging effect
  useEffect(() => {
    console.log("[Debug State] Current state:", {
      isProcessing,
      hasCode: !!newCode,
      hasThoughts: !!thoughtsData,
      hasTimeComplexity: !!timeComplexityData,
      hasSpaceComplexity: !!spaceComplexityData,
      cachedDebugData: !!cachedDebugData,
    });
  }, [
    isProcessing,
    newCode,
    thoughtsData,
    timeComplexityData,
    spaceComplexityData,
    cachedDebugData,
  ]);

  useEffect(() => {
    console.log("[Debug] Setting up event listeners");

    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => {
        console.log("[Debug] Screenshot taken");
        refetch();
      }),
      window.electronAPI.onResetView(() => {
        console.log("[Debug] Reset view");
        refetch();
      }),
      window.electronAPI.onDebugStart(() => {
        console.log("[Debug] Starting debug process");
        setIsProcessing(true);

        // Clear previous debug data
        setNewCode(null);
        setThoughtsData(null);
        setTimeComplexityData(null);
        setSpaceComplexityData(null);
        queryClient.setQueryData(["new_solution"], null);
      }),
      window.electronAPI.onDebugSuccess((data) => {
        console.log("[Debug] Success received with data:", {
          hasCode: !!data?.code,
          hasThoughts: !!data?.thoughts,
          hasTimeComplexity: !!data?.time_complexity,
          hasSpaceComplexity: !!data?.space_complexity,
          rawData: data,
        });

        if (!data) {
          console.error("[Debug] Received empty data in onDebugSuccess");
          showToast("Error", "Received invalid debug data", "error");
          setIsProcessing(false);
          return;
        }

        try {
          // Update state directly with proper type checking
          setNewCode(data.code || null);
          setThoughtsData(Array.isArray(data.thoughts) ? data.thoughts : null);
          setTimeComplexityData(
            typeof data.time_complexity === "string"
              ? data.time_complexity
              : null
          );
          setSpaceComplexityData(
            typeof data.space_complexity === "string"
              ? data.space_complexity
              : null
          );

          // Update cache with the processed data
          queryClient.setQueryData(["new_solution"], {
            code: data.code,
            thoughts: data.thoughts,
            time_complexity: data.time_complexity,
            space_complexity: data.space_complexity,
          });

          console.log("[Debug] State updates completed with:", {
            code: data.code,
            thoughts: data.thoughts,
            timeComplexity: data.time_complexity,
            spaceComplexity: data.space_complexity,
          });

          setIsProcessing(false);
        } catch (error) {
          console.error("[Debug] Error updating state:", error);
          showToast("Error", "Failed to update debug data", "error");
          setIsProcessing(false);
        }
      }),
      window.electronAPI.onDebugError((error: string) => {
        console.error("[Debug] Error:", error);
        showToast(
          "Processing Failed",
          "There was an error debugging your code.",
          "error"
        );
        setIsProcessing(false);
      }),
    ];

    return () => {
      console.log("[Debug] Cleaning up event listeners");
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [queryClient, refetch, setIsProcessing, showToast]);

  const handleDeleteScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index];
    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      );
      if (response.success) {
        refetch();
      } else {
        console.error("Failed to delete screenshot:", response.error);
      }
    } catch (error) {
      console.error("Error deleting screenshot:", error);
    }
  };

  return (
    <div ref={contentRef} className="relative space-y-3 px-4 py-3">
      <div className="bg-transparent w-fit">
        <div className="pb-3">
          <div className="space-y-3 w-fit">
            <ScreenshotQueue
              screenshots={screenshots}
              onDeleteScreenshot={handleDeleteScreenshot}
              isLoading={isProcessing}
            />
          </div>
        </div>
      </div>

      <div className="relative z-10">
        <SolutionCommands
          screenshots={screenshots}
          onTooltipVisibilityChange={(visible, height) => {
            setTooltipVisible(visible);
            setTooltipHeight(height);
          }}
          isProcessing={isProcessing}
          extraScreenshots={screenshots}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />
      </div>

      <div className="w-full text-sm text-foreground rounded-md select-none bg-background/80 backdrop-blur-md">
        <div className="rounded-lg overflow-hidden">
          <div className="px-4 py-3 space-y-4">
            <ContentSection
              title="What I Changed"
              content={
                <div className="space-y-3">
                  <div className="space-y-1">
                    {thoughtsData?.map((thought, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary mt-2 shrink-0" />
                        <div className="text-sm text-foreground">{thought}</div>
                      </div>
                    ))}
                  </div>
                </div>
              }
              isLoading={isProcessing || !thoughtsData}
            />

            <CodeSection
              title="Solution"
              code={newCode}
              isLoading={isProcessing || !newCode}
              currentLanguage={currentLanguage}
            />

            <ComplexitySection
              timeComplexity={timeComplexityData}
              spaceComplexity={spaceComplexityData}
              isLoading={
                isProcessing || (!timeComplexityData && !spaceComplexityData)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Debug;
