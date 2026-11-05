import "server-only";
import { NextResponse } from "next/server";
import { createDbClient } from "@/lib/server/db/client";
import { createSafeHeaders } from "@/lib/server/security/response";
import { generateRequestId, logTelemetry } from "@/lib/server/security/telemetry";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  const requestId = generateRequestId();
  const headers = createSafeHeaders(requestId);

  try {
    const db = createDbClient();
    const { data, error } = await db
      .from("catalog_versions")
      .select("id, status")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      logTelemetry({
        requestId,
        routeClass: "api.health",
        status: 503,
        durationMs: Date.now() - start,
        providerStatus: "error",
        errorCode: "DB_UNAVAILABLE",
      });

      return NextResponse.json(
        {
          status: "unhealthy",
          error: "Database service unavailable",
          timestamp: new Date().toISOString(),
        },
        { status: 503, headers: { ...headers, "Retry-After": "5" } }
      );
    }

    logTelemetry({
      requestId,
      routeClass: "api.health",
      status: 200,
      durationMs: Date.now() - start,
      providerStatus: "ok",
      catalogVersion: data.id,
    });

    return NextResponse.json(
      {
        status: "healthy",
        catalog: "ready",
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers }
    );
  } catch {
    logTelemetry({
      requestId,
      routeClass: "api.health",
      status: 503,
      durationMs: Date.now() - start,
      providerStatus: "error",
      errorCode: "HEALTH_CHECK_FAILED",
    });

    return NextResponse.json(
      {
        status: "unhealthy",
        error: "Database service unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { ...headers, "Retry-After": "5" } }
    );
  }
}
