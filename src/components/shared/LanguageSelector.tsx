import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

import React from "react";

interface LanguageSelectorProps {
  currentLanguage: string;
  setLanguage: (language: string) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  setLanguage,
}) => {
  const handleLanguageChange = async (newLanguage: string) => {
    try {
      setLanguage(newLanguage);
      window.__LANGUAGE__ = newLanguage;
    } catch (error) {
      console.error("Error updating language preference:", error);
    }
  };

  return (
    <div className="mb-3 px-2 space-y-1">
      <div className="flex items-center justify-between text-[13px] font-medium text-foreground">
        <span>Language</span>
        <Select value={currentLanguage} onValueChange={handleLanguageChange}>
          <SelectTrigger
            className="w-[140px] h-7 text-sm bg-accent border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent
            className="z-[150]"
            onClick={(e) => e.stopPropagation()}
          >
            <SelectItem value="python">Python</SelectItem>
            <SelectItem value="javascript">JavaScript</SelectItem>
            <SelectItem value="java">Java</SelectItem>
            <SelectItem value="golang">Go</SelectItem>
            <SelectItem value="cpp">C++</SelectItem>
            <SelectItem value="swift">Swift</SelectItem>
            <SelectItem value="kotlin">Kotlin</SelectItem>
            <SelectItem value="ruby">Ruby</SelectItem>
            <SelectItem value="sql">SQL</SelectItem>
            <SelectItem value="r">R</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
