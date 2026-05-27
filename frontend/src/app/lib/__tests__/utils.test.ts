import { describe, it, expect } from "vitest";
import { cn, formatCurrency, formatDate } from "../utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge tailwind classes correctly", () => {
      expect(cn("p-4", "p-2")).toBe("p-2");
      expect(cn("text-red-500", "bg-blue-500")).toBe("text-red-500 bg-blue-500");
    });
  });

  describe("formatCurrency", () => {
    it("should format COP currency correctly", () => {
      // Note: Intl formatting can vary slightly by environment, but we expect $ prefix and dots for thousands
      const formatted = formatCurrency(1000).replace(/\u00A0/g, ' '); // Replace non-breaking space
      expect(formatted).toMatch(/\$\s?1\.000/);
    });
  });

  describe("formatDate", () => {
    it("should format dates correctly", () => {
      const date = new Date(2026, 4, 27); // May 27, 2026
      const formatted = formatDate(date).replace(/\u00A0/g, ' ');
      expect(formatted).toContain("27");
      expect(formatted).toContain("2026");
    });
  });
});
