"use client";

import { Toaster as Sonner } from "sonner";

/** Dark-glass themed toast host */
function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      toastOptions={{
        style: {
          background: "rgba(18, 22, 28, 0.92)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#f2f5f7",
          backdropFilter: "blur(16px)",
          borderRadius: "0.9rem",
        },
      }}
    />
  );
}

export { Toaster };
