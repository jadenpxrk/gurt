import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./components/ui/toast";
import { useCallback, useEffect, useState } from "react";

import Main from "./_pages/Main";
import { ToastContext } from "./contexts/toast";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: Infinity,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Root component that provides the QueryClient
function App() {
  const [toastState, setToastState] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: "neutral" | "success" | "error";
  }>({
    open: false,
    title: "",
    description: "",
    variant: "neutral",
  });
  const [initialized, setInitialized] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<string>(
    window.__LANGUAGE__ || "python"
  );

  // Helper function to safely update language
  const updateLanguage = useCallback((newLanguage: string) => {
    setCurrentLanguage(newLanguage);
    window.__LANGUAGE__ = newLanguage;
  }, []);

  // Helper function to mark initialization complete
  const markInitialized = useCallback(() => {
    setInitialized(true);
    window.__IS_INITIALIZED__ = true;
  }, []);

  // Show toast method
  const showToast = useCallback(
    (
      title: string,
      description: string,
      variant: "neutral" | "success" | "error"
    ) => {
      setToastState({
        open: true,
        title,
        description,
        variant,
      });
    },
    []
  );

  // Initialize app with default values
  useEffect(() => {
    try {
      // Set default values
      updateLanguage("python");
      markInitialized();
    } catch (e) {
      console.error("Error setting initial language", e);
    }
  }, [updateLanguage, markInitialized]);

  // Close toast after delay
  useEffect(() => {
    if (toastState.open) {
      const timer = setTimeout(() => {
        setToastState((prev) => ({ ...prev, open: false }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastState.open]);

  // Render the main app directly without authentication check
  return (
    <QueryClientProvider client={queryClient}>
      <ToastContext.Provider value={{ showToast }}>
        <ToastProvider>
          <div className="min-h-screen bg-transparent">
            {initialized && (
              <Main
                currentLanguage={currentLanguage}
                setLanguage={updateLanguage}
              />
            )}
            <Toast
              open={toastState.open}
              onOpenChange={(open) =>
                setToastState((prev) => ({ ...prev, open }))
              }
              variant={toastState.variant}
            >
              <div className="grid gap-1">
                {toastState.title && (
                  <ToastTitle>{toastState.title}</ToastTitle>
                )}
                {toastState.description && (
                  <ToastDescription>{toastState.description}</ToastDescription>
                )}
              </div>
            </Toast>
            <ToastViewport className="fixed bottom-0 right-0 max-w-xs" />
          </div>
        </ToastProvider>
      </ToastContext.Provider>
    </QueryClientProvider>
  );
}

export default App;
