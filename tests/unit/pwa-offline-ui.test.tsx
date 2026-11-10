import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import OfflinePage from "@/app/offline/page";

describe("PWA Offline UI Components", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      configurable: true,
      writable: true,
    });
  });

  describe("OfflineBanner", () => {
    it("renders nothing when online initially", () => {
      render(<OfflineBanner />);
      expect(screen.queryByTestId("offline-banner")).toBeNull();
    });

    it("renders offline banner when initialized offline", () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        configurable: true,
        writable: true,
      });

      render(<OfflineBanner />);
      const banner = screen.getByTestId("offline-banner");
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent(/currently offline/i);
      expect(banner).toHaveAttribute("role", "status");
      expect(banner).toHaveAttribute("aria-live", "polite");
    });

    it("dynamically shows offline and online restored banners on window events", () => {
      render(<OfflineBanner />);
      expect(screen.queryByTestId("offline-banner")).toBeNull();

      // Go offline
      act(() => {
        window.dispatchEvent(new Event("offline"));
      });
      expect(screen.getByTestId("offline-banner")).toBeInTheDocument();

      // Go online
      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      expect(screen.queryByTestId("offline-banner")).toBeNull();
      expect(screen.getByTestId("online-restored-banner")).toBeInTheDocument();
      expect(screen.getByTestId("online-restored-banner")).toHaveTextContent(/connection restored/i);
    });
  });

  describe("OfflinePage", () => {
    it("renders offline explanation, status note, and 44px min hit action targets", () => {
      render(<OfflinePage />);

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/you are offline/i);
      expect(screen.getByRole("status")).toHaveTextContent(/safely stored on the server/i);

      const retryBtn = screen.getByRole("button", { name: /retry connection/i });
      expect(retryBtn).toBeInTheDocument();
      expect(retryBtn.className).toContain("min-h-[44px]");

      const homeLink = screen.getByRole("link", { name: /back to home/i });
      expect(homeLink).toBeInTheDocument();
      expect(homeLink).toHaveAttribute("href", "/");
      expect(homeLink.className).toContain("min-h-[44px]");
    });

    it("calls window.location.reload when Retry Connection is clicked", () => {
      const reloadMock = vi.fn();
      Object.defineProperty(window, "location", {
        value: { reload: reloadMock },
        writable: true,
      });

      render(<OfflinePage />);
      const retryBtn = screen.getByRole("button", { name: /retry connection/i });
      fireEvent.click(retryBtn);

      expect(reloadMock).toHaveBeenCalledTimes(1);
    });
  });
});
