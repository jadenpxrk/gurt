import React, { useEffect, useRef, useState } from "react";

import QueueCommands from "../components/Queue/QueueCommands";
import { Screenshot } from "../types/screenshots";
import ScreenshotQueue from "../components/Queue/ScreenshotQueue";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "../contexts/toast";

async function fetchScreenshots(): Promise<Screenshot[]> {
  try {
    const response = await window.electronAPI.getScreenshots();
    // Handle potential response structures
    const screenshots = response?.previews || response || [];
    // Ensure it's an array and map to Screenshot type if needed
    return (Array.isArray(screenshots) ? screenshots : []).map((p: any) => ({
      id: p.path, // Assuming id is needed based on other usage, using path as id
      path: p.path,
      preview: p.preview,
      timestamp: Date.now(), // Add timestamp if required by Screenshot type
    }));
  } catch (error) {
    console.error("Error loading screenshots:", error);
    throw error;
  }
}

interface QueueProps {
  setView: (view: "queue" | "solutions" | "debug") => void;
  currentLanguage: string;
  setLanguage: (language: string) => void;
}

function Queue({ setView, currentLanguage, setLanguage }: QueueProps) {
  const { showToast } = useToast();

  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipHeight, setTooltipHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const {
    data: screenshots = [],
    isLoading,
    refetch,
  } = useQuery<Screenshot[]>({
    queryKey: ["screenshots"],
    queryFn: fetchScreenshots,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const handleDeleteScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index];

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      );

      if (response.success) {
        refetch(); // Refetch screenshots instead of managing state directly
      } else {
        console.error("Failed to delete screenshot:", response.error);
        showToast("Error", "Failed to delete the screenshot file", "error");
      }
    } catch (error) {
      console.error("Error deleting screenshot:", error);
    }
  };

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
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => refetch()),

      window.electronAPI.onSolutionError((error: string) => {
        showToast(
          "Processing Failed",
          "There was an error processing your screenshots.",
          "error"
        );
        setView("queue"); // Revert to queue if processing fails
        console.error("Processing error:", error);
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          "No Screenshots",
          "There are no screenshots to process.",
          "neutral"
        );
      }),
    ];

    return () => {
      resizeObserver.disconnect();
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [isTooltipVisible, tooltipHeight]);

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible);
    setTooltipHeight(height);
  };

  return (
    <div ref={contentRef} className="w-0">
      <div className="px-4 py-3">
        <div className="space-y-3 w-fit">
          <ScreenshotQueue
            isLoading={false}
            screenshots={screenshots}
            onDeleteScreenshot={handleDeleteScreenshot}
          />

          <QueueCommands
            onTooltipVisibilityChange={handleTooltipVisibilityChange}
            screenshotCount={screenshots.length}
            currentLanguage={currentLanguage}
            setLanguage={setLanguage}
          />
        </div>
      </div>
    </div>
  );
}

export default Queue;
