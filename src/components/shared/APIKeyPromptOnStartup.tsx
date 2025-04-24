import React, { useEffect, useRef, useState } from "react";

import APIKeyModal from "./APIKeyModal";

/**
 * Component that listens for API key missing events and automatically
 * shows the API key modal when the app starts and no API key is found
 */
const APIKeyPromptOnStartup: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    console.log("APIKeyPromptOnStartup mounted");

    // Check for API key on mount
    const checkApiKey = async () => {
      try {
        console.log("Checking for API key...");
        const response = await window.electronAPI.getApiConfig();
        console.log("API key check response:", response);

        if (!response.success || !response.apiKey) {
          console.log("No API key found, showing modal");
          setShowModal(true);
        }
      } catch (error) {
        console.error("Error checking for API key:", error);
      }
    };

    checkApiKey();

    // Also listen for API key missing events
    console.log("Setting up API key missing listener");
    const cleanupIpcListener = window.electronAPI.onApiKeyMissing(() => {
      console.log("API key missing event received");
      setShowModal(true);
    });

    // Add listener for custom event to open API settings
    const handleOpenApiSettings = () => {
      console.log("Custom open-api-settings event received");
      setShowModal(true);
    };

    document.addEventListener("open-api-settings", handleOpenApiSettings);

    return () => {
      console.log("APIKeyPromptOnStartup unmounting");
      cleanupIpcListener();
      document.removeEventListener("open-api-settings", handleOpenApiSettings);
    };
  }, []);

  // When modal closes, check if we now have a valid key
  const handleModalClose = async () => {
    console.log("API key modal closed");
    setShowModal(false);

    // Check if we have a valid API key after modal closes
    try {
      const response = await window.electronAPI.getApiConfig();
      if (!response.success || !response.apiKey) {
        console.log("Still no valid API key after modal closed");
      } else {
        console.log("Valid API key detected after modal closed");
      }
    } catch (error) {
      console.error("Error checking API key after modal closed:", error);
    }
  };

  console.log("APIKeyPromptOnStartup rendering, showModal:", showModal);

  return (
    <>
      {/* Hidden button to trigger modal */}
      <button ref={buttonRef} className="hidden" aria-hidden="true">
        Open API Key Modal
      </button>

      {/* API Key Modal */}
      {showModal && (
        <APIKeyModal trigger={buttonRef.current} onClose={handleModalClose} />
      )}
    </>
  );
};

export default APIKeyPromptOnStartup;
