export interface ScriptResult {
  success: boolean;
  message: string;
  data?: unknown;
}

type ScriptAction = "annual-report" | "declaration";

const apiBaseUrl = import.meta.env.VITE_SCRIPT_API_BASE_URL ?? "";

const buildEndpoint = (path: string) => {
  if (!apiBaseUrl) {
    return path;
  }
  return `${apiBaseUrl}${path}`;
};

class ScriptService {
  private async runScript(action: ScriptAction): Promise<ScriptResult> {
    try {
      const response = await fetch(buildEndpoint("/api/scripts/run"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          message: payload?.message ?? "Script execution failed.",
          data: payload?.data ?? payload,
        };
      }

      return {
        success: true,
        message: payload?.message ?? "Script executed successfully.",
        data: payload?.data ?? payload,
      };
    } catch (error) {
      return {
        success: false,
        message: "Unable to reach the script service.",
      };
    }
  }

  runAnnualReportScript(): Promise<ScriptResult> {
    return this.runScript("annual-report");
  }

  runDeclarationScript(): Promise<ScriptResult> {
    return this.runScript("declaration");
  }
}

export const scriptService = new ScriptService();
