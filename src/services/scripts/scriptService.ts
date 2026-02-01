export interface ScriptResult {
  success: boolean;
  message: string;
  data?: unknown;
}

type ScriptAction = "annual-report" | "declaration";

const apiBaseUrl = import.meta.env.VITE_SCRIPT_API_BASE_URL ?? "";

const createLocalPdf = async (action: ScriptAction): Promise<void> => {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const text =
    action === "declaration" ? "created declaration" : "created annual report";
  doc.setFontSize(18);
  doc.text(text, 20, 40);
  doc.save(`${action}.pdf`);
};

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

      const contentType = response.headers.get("content-type") ?? "";
      if (response.ok && contentType.includes("application/pdf")) {
        const blob = await response.blob();
        const fallbackName = `${action}.pdf`;
        const contentDisposition = response.headers.get("content-disposition") ?? "";
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/i);
        const filename = filenameMatch?.[1] ?? fallbackName;
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(downloadUrl);
        return {
          success: true,
          message: "PDF downloaded successfully.",
        };
      }

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
      await createLocalPdf(action);
      return {
        success: true,
        message:
          "Script service unavailable, generated a local PDF placeholder.",
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
