import { Database } from "bun:sqlite";
import indexHtmlBundle from "./admin/index.html";
import { schemas, runMigrations } from "./api/infrastructure/schemas";
import { UnitOfWork } from "./api/infrastructure/unitOfWork";
import { TransactionBatcher } from "./api/infrastructure/transactionBatcher";
import { SchedulePoller } from "./api/infrastructure/schedulePoller";
import { createAuth } from "./api/infrastructure/auth";
import { AdminCommandsRouter } from "./api/infrastructure/routers/adminCommandsRouter";
import { AdminQueriesRouter } from "./api/infrastructure/routers/adminQueriesRouter";
import { getSecurityHeaders } from "./api/infrastructure/securityHeaders";
import { sanitizeError } from "./api/infrastructure/errorSanitizer";
import { PublishCollectionService } from "./api/app/collection/commands/admin/publishCollectionService";
import { UnpublishCollectionService } from "./api/app/collection/commands/admin/unpublishCollectionService";
import { ArchiveCollectionService } from "./api/app/collection/commands/admin/archiveCollectionService";
import { PublishProductService } from "./api/app/product/commands/admin/publishProductService";
import { UnpublishProductService } from "./api/app/product/commands/admin/unpublishProductService";
import { ArchiveProductService } from "./api/app/product/commands/admin/archiveProductService";
import { LocalImageStorageAdapter } from "./api/infrastructure/adapters/localImageStorageAdapter";
import { ImageOptimizer } from "./api/infrastructure/imageOptimizer";
import { ImageUploadHelper } from "./api/infrastructure/imageUploadHelper";
import type { ImageStorageAdapter } from "./api/infrastructure/adapters/imageStorageAdapter";
import { LocalDigitalAssetStorageAdapter } from "./api/infrastructure/adapters/localDigitalAssetStorageAdapter";
import { CreateCollectionService } from "./api/app/collection/commands/admin/createCollectionService";
import { DigitalAssetUploadHelper } from "./api/infrastructure/digitalAssetUploadHelper";
import type { DigitalAssetStorageAdapter } from "./api/infrastructure/adapters/digitalAssetStorageAdapter";
import type { CommandType } from "./api/app/command";

export class Slap {
  private static async seedFeaturedCollection(
    db: Database,
    unitOfWork: UnitOfWork,
  ) {
    try {
      const collectionCount = db
        .prepare("SELECT COUNT(*) as count FROM collectionsReadModel")
        .get() as { count: number };

      if (collectionCount.count === 0) {
        console.log("🌱 Seeding 'Featured' collection...");
        const createCollectionService = new CreateCollectionService(
          unitOfWork,
        );

        await createCollectionService.execute({
          id: Bun.randomUUIDv7(),
          type: "createCollection",
          correlationId: Bun.randomUUIDv7(),
          userId: "system",
          name: "Featured",
          description: "Our featured products",
          slug: "featured",
        });

        console.log("✅ Seeded 'Featured' collection");
      }
    } catch (error) {
      console.error("Failed to seed featured collection:", error);
    }
  }

  static init(options?: {
    db?: Database;
    port?: number;
    seedConfig?: {
      mode?: 'production' | 'development' | 'none';
      adminEmail?: string;
      adminPassword?: string;
      adminName?: string;
    };
    authConfig?: {
      secret?: string;
      baseURL?: string;
      trustedOrigins?: string;
      ipHeader?: string;
      nodeEnv?: string;
      authHandler?: (req: Request) => Promise<Response>;
    };
    storageConfig?: {
      imageStorageAdapter?: ImageStorageAdapter;
      digitalAssetStorageAdapter?: DigitalAssetStorageAdapter;
      imageOptimizer?: ImageOptimizer;
    };
  }): {
    server: ReturnType<typeof Bun.serve>;
    port: number;
    url: string;
    stop: () => void;
  } {
    const db = options?.db ?? Slap.initializeDatabase();
    const auth = createAuth(db, options?.authConfig);

    // Extract nodeEnv from authConfig to avoid reading process.env in tests
    const nodeEnv = options?.authConfig?.nodeEnv ?? process.env.NODE_ENV;

    // Determine seed mode
    const seedMode = options?.seedConfig?.mode ??
      (nodeEnv === "production" ? "production" : "development");

    // Seed admin user in development
    // Note: seedAdminUser has internal error handling, no outer catch needed
    if (seedMode === "development") {
      Slap.seedAdminUser(db, auth, options?.authConfig?.authHandler);
    }

    // Seed admin user in production
    // Note: seedAdminUserProduction has internal error handling, no outer catch needed
    if (seedMode === "production") {
      Slap.seedAdminUserProduction(
        db,
        auth,
        options?.seedConfig?.adminEmail,
        options?.seedConfig?.adminPassword,
        options?.seedConfig?.adminName,
        options?.authConfig?.authHandler,
      );
    }

    const { batcher, unitOfWork } = Slap.setupTransactionInfrastructure(db);

    // Seed featured collection
    // Note: seedFeaturedCollection has internal error handling, no outer catch needed
    Slap.seedFeaturedCollection(db, unitOfWork);
    const schedulePoller = Slap.setupSchedulePoller(db, unitOfWork);
    const { imageStorageAdapter, imageOptimizer } = Slap.setupImageStorage(
      options?.storageConfig?.imageStorageAdapter,
      options?.storageConfig?.imageOptimizer,
    );
    const imageUploadHelper = new ImageUploadHelper(
      imageStorageAdapter,
      imageOptimizer,
    );
    const digitalAssetStorageAdapter = Slap.setupDigitalAssetStorage(
      options?.storageConfig?.digitalAssetStorageAdapter,
    );
    const digitalAssetUploadHelper = new DigitalAssetUploadHelper(
      digitalAssetStorageAdapter,
    );
    const routers = Slap.createRouters(
      db,
      unitOfWork,
      imageUploadHelper,
      digitalAssetUploadHelper,
    );
    const jsonResponse = Slap.createJsonResponseHelper(nodeEnv);
    const routeHandlers = Slap.createRouteHandlers(routers, jsonResponse, auth);

    const server = Slap.startServer(
      routeHandlers,
      auth,
      nodeEnv,
      options?.port,
      imageStorageAdapter,
      digitalAssetStorageAdapter,
    );

    return {
      server,
      port: server.port ?? 0,
      url: server.url.toString(),
      stop: () => {
        server.stop();
        batcher.stop();
        schedulePoller.stop();
      },
    };
  }

  private static initializeDatabase(): Database {
    const db = new Database("slap.db");
    for (const schema of schemas) {
      db.run(schema);
    }
    // Run migrations to add any missing columns to existing tables
    runMigrations(db);
    return db;
  }

  private static async seedAdminUser(
    db: Database,
    auth: ReturnType<typeof createAuth>,
    authHandlerOverride?: (req: Request) => Promise<Response>,
  ) {
    try {
      // Check if any users exist
      const userCount = db
        .prepare("SELECT COUNT(*) as count FROM user")
        .get() as { count: number };

      if (userCount.count === 0) {
        // Development seed uses hardcoded defaults (not env vars)
        const adminEmail = "admin@example.com";
        const adminPassword = "admin123";
        const adminName = "Admin User";

        // Create a mock request to use Better Auth's signUp API
        // Better Auth expects the path to match the basePath + /sign-up/email
        const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
        const signUpRequest = new Request(`${baseURL}/api/auth/sign-up/email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: adminEmail,
            password: adminPassword,
            name: adminName,
          }),
        });

        // Use Better Auth's handler to create the user
        const handler = authHandlerOverride ?? auth.handler;
        const response = await handler(signUpRequest);

        if (response.ok) {
          console.log(`✅ Seeded admin user: ${adminEmail} / ${adminPassword}`);
        } else {
          const errorText = await response.text();
          console.error(
            `Failed to seed admin user: ${response.status} - ${errorText}`,
          );
        }
      }
    } catch (error) {
      console.error("Failed to seed admin user:", error);
    }
  }

  private static async seedAdminUserProduction(
    db: Database,
    auth: ReturnType<typeof createAuth>,
    adminEmailOverride?: string,
    adminPasswordOverride?: string,
    adminNameOverride?: string,
    authHandlerOverride?: (req: Request) => Promise<Response>,
  ) {
    try {
      // Check if any users exist
      const userCount = db
        .prepare("SELECT COUNT(*) as count FROM user")
        .get() as { count: number };

      if (userCount.count === 0) {
        // Use provided values or fall back to environment variables
        const adminEmail = adminEmailOverride ?? process.env.ADMIN_EMAIL;
        const adminPassword = adminPasswordOverride ?? process.env.ADMIN_PASSWORD;
        const adminName = adminNameOverride ?? process.env.ADMIN_NAME;

        if (!adminEmail || !adminPassword || !adminName) {
          throw new Error(
            "Production admin user seeding requires ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME environment variables to be set",
          );
        }

        // Create a mock request to use Better Auth's signUp API
        // Better Auth expects the path to match the basePath + /sign-up/email
        const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
        const signUpRequest = new Request(`${baseURL}/api/auth/sign-up/email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: adminEmail,
            password: adminPassword,
            name: adminName,
          }),
        });

        // Use Better Auth's handler to create the user
        const handler = authHandlerOverride ?? auth.handler;
        const response = await handler(signUpRequest);

        if (response.ok) {
          console.log(`✅ Seeded production admin user: ${adminEmail}`);
        } else {
          const errorText = await response.text();
          console.error(
            `Failed to seed production admin user: ${response.status} - ${errorText}`,
          );
        }
      }
    } catch (error) {
      console.error("Failed to seed production admin user:", error);
    }
  }


  private static setupTransactionInfrastructure(db: Database) {
    const batcher = new TransactionBatcher(db);
    batcher.start();
    const unitOfWork = new UnitOfWork(db, batcher);
    return { batcher, unitOfWork };
  }

  private static setupSchedulePoller(
    db: Database,
    unitOfWork: UnitOfWork,
  ) {
    const schedulePoller = new SchedulePoller(
      db,
      unitOfWork,
    );

    // Register command handlers for schedulable commands
    const publishCollectionService = new PublishCollectionService(
      unitOfWork,
    );
    const unpublishCollectionService = new UnpublishCollectionService(
      unitOfWork,
    );
    const archiveCollectionService = new ArchiveCollectionService(
      unitOfWork,
    );
    const publishProductService = new PublishProductService(
      unitOfWork,
    );
    const unpublishProductService = new UnpublishProductService(
      unitOfWork,
    );
    const archiveProductService = new ArchiveProductService(
      unitOfWork,
    );

    schedulePoller.registerCommandHandler(
      "publishCollection",
      publishCollectionService,
    );
    schedulePoller.registerCommandHandler(
      "unpublishCollection",
      unpublishCollectionService,
    );
    schedulePoller.registerCommandHandler(
      "archiveCollection",
      archiveCollectionService,
    );
    schedulePoller.registerCommandHandler(
      "publishProduct",
      publishProductService,
    );
    schedulePoller.registerCommandHandler(
      "unpublishProduct",
      unpublishProductService,
    );
    schedulePoller.registerCommandHandler(
      "archiveProduct",
      archiveProductService,
    );

    // Start the poller
    schedulePoller.start();
    console.log("✅ SchedulePoller started");

    return schedulePoller;
  }

  private static createRouters(
    db: Database,
    unitOfWork: UnitOfWork,
    imageUploadHelper: ImageUploadHelper,
    digitalAssetUploadHelper: DigitalAssetUploadHelper,
  ) {
    return {
      adminCommands: AdminCommandsRouter.create(
        unitOfWork,
        imageUploadHelper,
        digitalAssetUploadHelper,
      ),
      adminQueries: AdminQueriesRouter.create(db),
    };
  }

  private static createJsonResponseHelper(nodeEnv?: string) {
    const securityHeaders = getSecurityHeaders(nodeEnv);
    return (data: unknown, status = 200): Response => {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          ...securityHeaders,
        },
      });
    };
  }

  private static setupImageStorage(
    imageStorageAdapter?: ImageStorageAdapter,
    imageOptimizer?: ImageOptimizer,
  ): {
    imageStorageAdapter: ImageStorageAdapter;
    imageOptimizer: ImageOptimizer;
  } {
    return {
      imageStorageAdapter: imageStorageAdapter ?? new LocalImageStorageAdapter(),
      imageOptimizer: imageOptimizer ?? new ImageOptimizer(),
    };
  }

  private static setupDigitalAssetStorage(
    digitalAssetStorageAdapter?: DigitalAssetStorageAdapter,
  ): DigitalAssetStorageAdapter {
    return digitalAssetStorageAdapter ?? new LocalDigitalAssetStorageAdapter();
  }

  private static createRouteHandlers(
    routers: ReturnType<typeof Slap.createRouters>,
    jsonResponse: ReturnType<typeof Slap.createJsonResponseHelper>,
    auth: ReturnType<typeof createAuth>,
  ) {
    return {
      adminCommands: Slap.createAdminCommandsHandler(
        routers.adminCommands,
        jsonResponse,
        auth,
      ),
      adminQueries: Slap.createAdminQueriesHandler(
        routers.adminQueries,
        jsonResponse,
        auth,
      ),
    };
  }

  private static createAdminCommandsHandler(
    router: AdminCommandsRouter,
    jsonResponse: ReturnType<typeof Slap.createJsonResponseHelper>,
    auth: ReturnType<typeof createAuth>,
  ) {
    // Note: This handler is only called for POST requests via route configuration
    return async (request: Request): Promise<Response> => {
      // Validate JSON and request format before checking auth
      let body: { type: string; payload: unknown };
      try {
        body = (await request.json()) as { type: string; payload: unknown };
      } catch (error) {
        const sanitized = sanitizeError(
          error instanceof Error ? error : new Error("Invalid JSON"),
        );
        return jsonResponse({ success: false, error: sanitized }, 400);
      }

      const { type, payload } = body;
      if (!type || !payload) {
        const sanitized = sanitizeError(
          new Error("Request must include type and payload"),
        );
        return jsonResponse({ success: false, error: sanitized }, 400);
      }

      // Check authentication after validating request format
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) {
        const sanitized = sanitizeError(new Error("Unauthorized"));
        const response = jsonResponse(
          { success: false, error: sanitized },
          401,
        );
        // Add WWW-Authenticate header for Basic Auth compatibility
        response.headers.set("WWW-Authenticate", 'Basic realm="Admin API"');
        return response;
      }

      // Inject userId from session into command payload
      const payloadWithUserId = {
        ...payload,
        userId: session.user.id,
      };

      const result = await router.execute(type as CommandType, payloadWithUserId);

      if (result.success) {
        return jsonResponse({ success: true, data: result.data });
      } else {
        const sanitized = sanitizeError(result.error);
        // Use 422 for validation errors, 400 for other client errors
        const status = sanitized.type === 'ValidationError' ? 422 : 400;
        return jsonResponse({ success: false, error: sanitized }, status);
      }
    };
  }

  private static createAdminQueriesHandler(
    router: AdminQueriesRouter,
    jsonResponse: ReturnType<typeof Slap.createJsonResponseHelper>,
    auth: ReturnType<typeof createAuth>,
  ) {
    // Note: This handler is only called for POST requests via route configuration
    return async (request: Request): Promise<Response> => {
      // Validate JSON and request format before checking auth
      let body: { type: string; params?: unknown };
      try {
        body = (await request.json()) as { type: string; params?: unknown };
      } catch (error) {
        const sanitized = sanitizeError(
          error instanceof Error ? error : new Error("Invalid JSON"),
        );
        return jsonResponse({ success: false, error: sanitized }, 400);
      }

      const { type, params } = body;
      if (!type) {
        const sanitized = sanitizeError(new Error("Request must include type"));
        return jsonResponse({ success: false, error: sanitized }, 400);
      }

      // Check authentication after validating request format
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) {
        const sanitized = sanitizeError(new Error("Unauthorized"));
        const response = jsonResponse(
          { success: false, error: sanitized },
          401,
        );
        // Add WWW-Authenticate header for Basic Auth compatibility
        response.headers.set("WWW-Authenticate", 'Basic realm="Admin API"');
        return response;
      }

      const result = router.execute(type as any, params);

      if (result.success) {
        return jsonResponse({ success: true, data: result.data });
      } else {
        const sanitized = sanitizeError(result.error);
        // Use 422 for validation errors, 400 for other client errors
        const status = sanitized.type === 'ValidationError' ? 422 : 400;
        return jsonResponse({ success: false, error: sanitized }, status);
      }
    };
  }

  private static startServer(
    routeHandlers: ReturnType<typeof Slap.createRouteHandlers>,
    auth: ReturnType<typeof createAuth>,
    nodeEnv: string | undefined,
    port?: number,
    imageStorageAdapter?: ImageStorageAdapter,
    digitalAssetStorageAdapter?: DigitalAssetStorageAdapter,
  ): ReturnType<typeof Bun.serve> {
    const securityHeaders = getSecurityHeaders(nodeEnv);
    const isProduction = (nodeEnv ?? process.env.NODE_ENV) === "production";

    // Helper to wrap Better Auth responses with security headers
    const wrapAuthHandler = async (req: Request): Promise<Response> => {
      const response = await auth.handler(req);
      // Create new headers with security headers added
      const newHeaders = new Headers(response.headers);
      Object.entries(securityHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      // Return new response with security headers
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    };

    // Create OPTIONS handler for CORS preflight
    const handleOptions = () => {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          ...securityHeaders,
        },
      });
    };

    // Create method not allowed handler
    const handleMethodNotAllowed = () => {
      return new Response(JSON.stringify("Method not allowed"), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          ...securityHeaders,
        },
      });
    };

    // Helper to serve static images (only for local adapter)
    const serveStaticImage = async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const pathname = url.pathname;

      // Only serve if using local adapter
      if (!imageStorageAdapter?.isLocalStorage()) {
        return new Response("Not found", { status: 404 });
      }

      // Extract the file path from /storage/images/{imageId}/{filename}
      const match = pathname.match(/^\/storage\/images\/(.+)$/);
      if (!match) {
        return new Response("Not found", { status: 404 });
      }

      const filePath = `./storage/images/${match[1]}`;
      const file = Bun.file(filePath);

      if (!(await file.exists())) {
        return new Response("Not found", { status: 404 });
      }

      // Determine content type from file extension
      const ext = pathname.split(".").pop()?.toLowerCase();
      const contentTypeMap: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        avif: "image/avif",
        gif: "image/gif",
      };
      const contentType =
        contentTypeMap[ext || ""] || "application/octet-stream";

      return new Response(file, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          ...securityHeaders,
        },
      });
    };

    // Helper to serve static digital assets (only for local adapter, requires auth)
    const serveStaticDigitalAsset = async (
      request: Request
    ): Promise<Response> => {
      const url = new URL(request.url);
      const pathname = url.pathname;

      console.log("🔍 Digital asset request:", pathname);

      // Only serve if using local adapter
      if (!digitalAssetStorageAdapter?.isLocalStorage()) {
        console.log("❌ Not using local storage");
        return new Response("Not found", { status: 404 });
      }

      // Check authentication
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user) {
        console.log("❌ No authenticated session");
        return new Response("Unauthorized", { status: 401 });
      }

      console.log("✅ Authenticated user:", session.user.id);

      // Extract the file path from /storage/digital-assets/{assetId}/{filename}
      const match = pathname.match(/^\/storage\/digital-assets\/(.+)$/);
      if (!match || !match[1]) {
        console.log("❌ Path doesn't match pattern");
        return new Response("Not found", { status: 404 });
      }

      // Decode the URL-encoded path to handle spaces and special characters
      const decodedPath = decodeURIComponent(match[1]);
      const filePath = `./storage/digital-assets/${decodedPath}`;
      console.log("📁 Looking for file:", filePath);
      const file = Bun.file(filePath);

      if (!(await file.exists())) {
        console.log("❌ File does not exist:", filePath);
        return new Response("Not found", { status: 404 });
      }

      console.log("✅ File found, serving:", filePath);

      // Determine content type from file extension or default to octet-stream
      const ext = pathname.split(".").pop()?.toLowerCase();
      const contentTypeMap: Record<string, string> = {
        pdf: "application/pdf",
        zip: "application/zip",
        epub: "application/epub+zip",
        mp3: "audio/mpeg",
        mp4: "video/mp4",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
      };
      const contentType =
        contentTypeMap[ext || ""] || "application/octet-stream";

      // Get filename for content-disposition (use decoded path)
      const filename = decodedPath.split("/").pop() || "download";

      // Encode filename properly for Content-Disposition header (RFC 5987)
      // This handles special characters and non-ASCII characters
      const encodedFilename = encodeURIComponent(filename);

      return new Response(file, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodedFilename}`,
          "Cache-Control": "private, no-cache",
          ...securityHeaders,
        },
      });
    };

    // Helper to serve admin HTML with security headers
    // We serve the HTML file directly with security headers
    // Note: In production, this serves the raw HTML. In development with HMR,
    // the development config handles the bundling separately.
    const serveAdminHtml = async (): Promise<Response> => {
      const htmlPath = indexHtmlBundle.index;
      const htmlContent = await Bun.file(htmlPath).text();

      return new Response(htmlContent, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          ...securityHeaders,
        },
      });
    };

    return Bun.serve({
      port,
      routes: {
        "/admin/api/commands": {
          POST: routeHandlers.adminCommands,
          OPTIONS: handleOptions,
          GET: handleMethodNotAllowed,
          PUT: handleMethodNotAllowed,
          DELETE: handleMethodNotAllowed,
          PATCH: handleMethodNotAllowed,
        },
        "/admin/api/queries": {
          POST: routeHandlers.adminQueries,
          OPTIONS: handleOptions,
          GET: handleMethodNotAllowed,
          PUT: handleMethodNotAllowed,
          DELETE: handleMethodNotAllowed,
          PATCH: handleMethodNotAllowed,
        },
        "/storage/images/*": {
          GET: serveStaticImage,
          OPTIONS: handleOptions,
          POST: handleMethodNotAllowed,
          PUT: handleMethodNotAllowed,
          DELETE: handleMethodNotAllowed,
          PATCH: handleMethodNotAllowed,
        },
        "/storage/digital-assets/*": {
          GET: serveStaticDigitalAsset,
          OPTIONS: handleOptions,
          POST: handleMethodNotAllowed,
          PUT: handleMethodNotAllowed,
          DELETE: handleMethodNotAllowed,
          PATCH: handleMethodNotAllowed,
        },
        "/api/auth": {
          GET: wrapAuthHandler,
          POST: wrapAuthHandler,
          OPTIONS: handleOptions,
          PUT: handleMethodNotAllowed,
          DELETE: handleMethodNotAllowed,
          PATCH: handleMethodNotAllowed,
        },
        "/api/auth/*": {
          GET: wrapAuthHandler,
          POST: wrapAuthHandler,
          OPTIONS: handleOptions,
          PUT: handleMethodNotAllowed,
          DELETE: handleMethodNotAllowed,
          PATCH: handleMethodNotAllowed,
        },
        "/admin": {
          GET: serveAdminHtml,
          OPTIONS: handleOptions,
          POST: handleMethodNotAllowed,
          PUT: handleMethodNotAllowed,
          DELETE: handleMethodNotAllowed,
          PATCH: handleMethodNotAllowed,
        },
        "/admin/*": {
          GET: serveAdminHtml,
          OPTIONS: handleOptions,
          POST: handleMethodNotAllowed,
          PUT: handleMethodNotAllowed,
          DELETE: handleMethodNotAllowed,
          PATCH: handleMethodNotAllowed,
        },
      },
      development: !isProduction && {
        // Enable browser hot reloading in development
        hmr: true,
        // Echo console logs from the browser to the server
        console: true,
      },
      async fetch(request) {
        // HTTPS enforcement in production
        if (isProduction && new URL(request.url).protocol === "http:") {
          const url = new URL(request.url);
          url.protocol = "https:";
          return new Response(null, {
            status: 301,
            headers: {
              Location: url.toString(),
              ...securityHeaders,
            },
          });
        }

        // Handle CORS preflight for unmatched routes
        if (request.method === "OPTIONS") {
          return handleOptions();
        }
        return new Response("Not found", {
          status: 404,
          headers: {
            "Access-Control-Allow-Origin": "*",
            ...securityHeaders,
          },
        });
      },
    });
  }
}
