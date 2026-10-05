"use client";

import { createContext, useContext } from "react";
import { viMessages, type UiMessages } from "@/i18n/vi";

export { viMessages, type UiMessages } from "@/i18n/vi";

const I18nContext = createContext<UiMessages>(viMessages);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nContext.Provider value={viMessages}>
      {children}
    </I18nContext.Provider>
  );
}

export function useMessages() {
  return useContext(I18nContext);
}
