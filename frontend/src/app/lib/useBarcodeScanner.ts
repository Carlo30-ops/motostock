import { useEffect, useRef } from "react";

/**
 * Hook for listening to USB Barcode Scanners.
 * USB scanners emulate a keyboard, rapidly typing digits followed by an Enter key.
 */
export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const buffer = useRef<string>("");
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in a text input (unless it's specifically meant to catch it, but globally it's safer to just capture rapid typing)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // If we want it to work globally even when an input is focused, we can remove this block.
        // But usually, if they scan, it goes into the input anyway. 
        // For "listen continuous keyboard input", we capture rapid keystrokes.
      }

      if (e.key === "Enter" && buffer.current.length >= 12) {
        // Typical EAN-13 is 13 digits
        onScan(buffer.current);
        buffer.current = "";
        e.preventDefault();
        return;
      }

      if (/^\d$/.test(e.key)) {
        buffer.current += e.key;
        
        // Reset buffer if typing is too slow (human typing vs scanner)
        if (timeoutId.current) clearTimeout(timeoutId.current);
        timeoutId.current = setTimeout(() => {
          buffer.current = "";
        }, 50); // 50ms is strict enough to ignore fast human typing but catch scanners (<20ms per key)
      } else {
        buffer.current = ""; // Reset on non-digit
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutId.current) clearTimeout(timeoutId.current);
    };
  }, [onScan]);
}
