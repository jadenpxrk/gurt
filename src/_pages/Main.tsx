import { useEffect, useRef, useState } from "react";

import Queue from "./Queue";
import Solutions from "./Solutions";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../contexts/toast";

interface MainProps {
  currentLanguage: string;
  setLanguage: (language: string) => void;
}

function Main({ currentLanguage, setLanguage }: MainProps) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"queue" | "solutions" | "debug">("queue");
  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const cleanup = window.electronAPI.onResetView(() => {
      queryClient.invalidateQueries({
        queryKey: ["screenshots"],
      });
      queryClient.invalidateQueries({
        queryKey: ["problem_statement"],
      });
      queryClient.invalidateQueries({
        queryKey: ["solution"],
      });
      queryClient.invalidateQueries({
        queryKey: ["new_solution"],
      });
      setView("queue");
    });

    return () => {
      cleanup();
    };
  }, []);

  // Dynamically update the window size
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (!containerRef.current) return;
      const height = containerRef.current.scrollHeight;
      const width = containerRef.current.scrollWidth;
      window.electronAPI?.updateContentDimensions({ width, height });
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    // Also watch DOM changes
    const mutationObserver = new MutationObserver(updateDimensions);
    mutationObserver.observe(containerRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    // Initial dimension update
    updateDimensions();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [view]);

  // Listen for events that might switch views or show errors
  useEffect(() => {
    const cleanupFunctions = [
      window.electronAPI.onSolutionStart(() => {
        setView("solutions");
      }),
      window.electronAPI.onUnauthorized(() => {
        queryClient.removeQueries({
          queryKey: ["screenshots"],
        });
        queryClient.removeQueries({
          queryKey: ["solution"],
        });
        queryClient.removeQueries({
          queryKey: ["problem_statement"],
        });
        setView("queue");
      }),
      window.electronAPI.onResetView(() => {
        queryClient.removeQueries({
          queryKey: ["screenshots"],
        });
        queryClient.removeQueries({
          queryKey: ["solution"],
        });
        queryClient.removeQueries({
          queryKey: ["problem_statement"],
        });
        setView("queue");
      }),
      window.electronAPI.onResetView(() => {
        queryClient.setQueryData(["problem_statement"], null);
      }),
      window.electronAPI.onProblemExtracted((data: any) => {
        if (view === "queue") {
          queryClient.invalidateQueries({
            queryKey: ["problem_statement"],
          });
          queryClient.setQueryData(["problem_statement"], data);
        }
      }),
      window.electronAPI.onSolutionError((error: string) => {
        showToast("Error", error, "error");
      }),
    ];
    return () => cleanupFunctions.forEach((fn) => fn());
  }, [view]);

  return (
    <div ref={containerRef} className="min-h-0">
      {view === "queue" ? (
        <Queue
          setView={setView}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />
      ) : view === "solutions" ? (
        <Solutions
          setView={setView}
          currentLanguage={currentLanguage}
          setLanguage={setLanguage}
        />
      ) : null}
    </div>
  );
}

export default Main;
