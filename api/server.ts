import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

type ScoutSuiteAwsInput = {
  full_report?: boolean;
  max_workers?: number;
  services?: string[];
  skip_services?: string[];
  profile?: string;
  acces_keys?: string;
  access_key_id?: string;
  secret_acces_key?: string;
  session_token?: string;
  regions?: string;
  exclude_regions?: string;
  ip_ranges?: string;
  ip_ranges_name_key?: string;
};

const rawHandler = createMcpHandler(
  (server) => {
    server.tool(
      "do-scoutsuite-aws",
      "Performs an AWS cloud security audit using Scout Suite for the given target settings, allowing service/region filtering and multiple authentication methods.",
      {
        full_report: z
          .boolean()
          .optional()
          .describe("Return full findings instead of summary keys."),
        max_workers: z
          .number()
          .optional()
          .describe("Maximum number of parallel worker threads used by Scout Suite (default: 10)."),
        services: z
          .array(z.string())
          .optional()
          .describe("AWS service names to include in scope (default: all services)."),
        skip_services: z
          .array(z.string())
          .optional()
          .describe("AWS service names to exclude from scope."),
        profile: z
          .string()
          .optional()
          .describe("Use a named AWS CLI profile for authentication."),
        acces_keys: z
          .string()
          .optional()
          .describe("Flag to run using access keys instead of profile."),
        access_key_id: z
          .string()
          .optional()
          .describe("AWS Access Key ID used for authentication."),
        secret_acces_key: z
          .string()
          .optional()
          .describe("AWS Secret Access Key used for authentication."),
        session_token: z
          .string()
          .optional()
          .describe("Temporary AWS session token (if using temporary credentials)."),
        regions: z
          .string()
          .optional()
          .describe("Comma-separated list of AWS regions to include in the scan (default: all regions)."),
        exclude_regions: z
          .string()
          .optional()
          .describe("Comma-separated list of AWS regions to exclude from the scan."),
        ip_ranges: z
          .string()
          .optional()
          .describe("Path to JSON file(s) containing known IP ranges to match findings against."),
        ip_ranges_name_key: z
          .string()
          .optional()
          .describe("Key in the IP ranges file that maps to the display name of a known CIDR."),
      },
      async ({
        full_report,
        max_workers,
        services,
        skip_services,
        profile,
        acces_keys,
        access_key_id,
        secret_acces_key,
        session_token,
        regions,
        exclude_regions,
        ip_ranges,
        ip_ranges_name_key,
      }: ScoutSuiteAwsInput) => {
        const args: string[] = ["aws", "--force", "--no-browser"];

        if (max_workers) args.push("--max-workers", max_workers.toString());
        if (services?.length) {
          args.push("--services", ...services);
        }
        if (skip_services?.length) {
          args.push("--skip", ...skip_services);
        }
        if (profile) args.push("--profile", profile);
        if (acces_keys) args.push("--access-keys");
        if (access_key_id) args.push("--access-key-id", access_key_id);
        if (secret_acces_key) args.push("--secret-access-key", secret_acces_key);
        if (session_token) args.push("--session-token", session_token);
        if (regions) args.push("--regions", regions);
        if (exclude_regions) args.push("--exclude-regions", exclude_regions);
        if (ip_ranges) args.push("--ip-ranges", ip_ranges);
        if (ip_ranges_name_key) args.push("--ip-ranges-name-key", ip_ranges_name_key);

        const command = ["scoutsuite", ...args].join(" ");

        return {
          content: [
            {
              type: "text",
              text: [
                "Scout Suite must run in an environment with AWS access. This MCP server runs on Vercel serverless, so it returns the exact command to execute locally:",
                "",
                command,
                "",
                "After running, review the generated report (scoutsuite-report/scoutsuite-results/scoutsuite_results_<timestamp>.js) for findings.",
                full_report
                  ? "Use --full_report=true here only toggles your intent; include or omit flags as needed in the command."
                  : "",
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        };
      },
    );
  },
  {
    capabilities: {
      tools: {
        "do-scoutsuite-aws": {
          description:
            "Performs an AWS cloud security audit using Scout Suite for the given target settings, allowing service/region filtering and multiple authentication methods.",
        },
      },
    },
  },
  { basePath: "/api", verboseLogs: true, maxDuration: 60, disableSse: true },
);

const handler = async (request: Request) => {
  try {
    return await (rawHandler as any)(request);
  } catch (error) {
    console.error("scout mcp handler error", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};

export default handler;
