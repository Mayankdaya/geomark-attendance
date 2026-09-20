"use client";

import { Toaster as Sonner } from "sonner";

/** Paper toast host — white card, hairline border, ink text. */
function Toaster() {
  return (
    <Sonner
      theme="light"
      position="top-center"
      toastOptions={{
        style: {
          background: "#ffffff",
          border: "1px solid var(--line-strong)",
          color: "var(--ink)",
          boxShadow: "0 12px 32px -12px rgba(29,26,22,0.28)",
          borderRadius: "8px",
          fontSize: "13.5px",
        },
      }}
    />
  );
}

export { Toaster };
