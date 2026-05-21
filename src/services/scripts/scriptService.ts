export interface ScriptResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export type AnnualReportQuestionKind = "text" | "textarea" | "int" | "number" | "bool" | "select";

export interface AnnualReportQuestionOption {
  value: string;
  label: string;
}

export interface AnnualReportQuestionDependency {
  field: string;
  value: unknown;
}

export interface AnnualReportQuestionField {
  id: string;
  label: string;
  kind: AnnualReportQuestionKind;
  section: string;
  widget?: "input" | "textarea" | "switch" | "select" | "date";
  options?: AnnualReportQuestionOption[];
  dependsOn?: AnnualReportQuestionDependency;
}

export interface AnnualReportQuestionRepeater {
  id: string;
  label: string;
  kind: "year_history" | "signatories";
  section: string;
  yearsBack?: number[];
  countField?: AnnualReportQuestionField;
  fields: AnnualReportQuestionField[];
}

export interface AnnualReportQuestionSchema {
  title: string;
  source: string;
  fields: AnnualReportQuestionField[];
  repeaters: AnnualReportQuestionRepeater[];
  sectionOrder: string[];
  sectionLabels: Record<string, string>;
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

      if (!response.ok && (!apiBaseUrl || response.status === 404 || response.status === 503)) {
        await createLocalPdf(action);
        return {
          success: true,
          message:
            "Script service unavailable, generated a local PDF placeholder.",
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

  async fetchAnnualReportQuestionSchema(): Promise<AnnualReportQuestionSchema> {
    const staticResponse = await fetch("/annual-report-question-schema.json", {
      headers: {
        Accept: "application/json",
      },
    });

    const contentType = staticResponse.headers.get("content-type") ?? "";
    if (staticResponse.ok && contentType.includes("application/json")) {
      return (await staticResponse.json()) as AnnualReportQuestionSchema;
    }

    const response = await fetch(buildEndpoint("/api/annual-report/questions"), {
      headers: {
        Accept: "application/json",
      },
    });
    const apiContentType = response.headers.get("content-type") ?? "";

    if (!apiContentType.includes("application/json")) {
      throw new Error("Question schema endpoint returned HTML instead of JSON.");
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload?.success || !payload?.data) {
      throw new Error(payload?.message ?? "Could not load annual report question schema.");
    }

    return payload.data as AnnualReportQuestionSchema;
  }
}

export const scriptService = new ScriptService();
