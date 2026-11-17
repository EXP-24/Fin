import { useEffect, useState } from "react";
import { api } from "../api.js";

/**
 * Arithmetic-validation result of one document (spec 3.4): identities such as
 * "Tổng tài sản = Tài sản ngắn hạn + Tài sản dài hạn" re-computed from the
 * extracted numbers. A mismatch means the extracted data is inconsistent (often an
 * OCR misread) — it is not a statement about the company's finances.
 */
export default function ValidationSection({ sessionId, doc, t, locale }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setReport(null);
    setError("");
    if (!doc || doc.status !== "ready") return undefined;
    setLoading(true);
    api
      .getValidation(sessionId, doc.id)
      .then((r) => alive && setReport(r))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sessionId, doc?.id, doc?.status]);

  if (!doc) return null;
  const fmt = (n) => Number(n).toLocaleString(locale);

  return (
    <section aria-labelledby="validation-title" className="flex flex-col gap-2">
      <h4 id="validation-title" className="font-label-mono text-label-mono uppercase text-outline">
        {t("Arithmetic check")}
      </h4>

      {doc.status !== "ready" && <p className="text-body-sm text-on-surface-variant">{t("Available once the document is ready.")}</p>}
      {loading && <div className="h-12 rounded-lg bg-surface-container animate-pulse" />}
      {error && <p role="alert" className="text-body-sm text-error">{error}</p>}

      {report && report.status === "no_data" && (
        <p className="text-body-sm text-on-surface-variant">{t("No statement tables with line codes were recognised, so the numbers could not be checked.")}</p>
      )}

      {report && report.status !== "no_data" && (
        <>
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-body-sm ${
              report.warnings.length === 0 ? "bg-secondary/10 text-secondary" : "bg-tertiary/10 text-tertiary"
            }`}
            role="status"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              {report.warnings.length === 0 ? "check_circle" : "warning"}
            </span>
            <span>
              {report.warnings.length === 0
                ? `${t("All checks passed")}: ${report.checks_passed}/${report.checks_run}`
                : `${report.warnings.length} ${t("checks do not match")} (${report.checks_passed}/${report.checks_run} ${t("passed")})`}
            </span>
          </div>

          {report.warnings.map((w, i) => (
            <div key={`${w.rule}-${w.year}-${i}`} className="rounded-lg border border-outline-variant/40 bg-surface-container p-3 text-body-sm">
              <div className="font-semibold text-on-surface break-words">{w.title}</div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-label-mono text-label-mono">
                <dt className="text-outline">{t("Year")}</dt>
                <dd className="text-on-surface">{w.year}</dd>
                <dt className="text-outline">{t("Expected")}</dt>
                <dd className="text-on-surface text-right">{fmt(w.expected)}</dd>
                <dt className="text-outline">{t("Read from report")}</dt>
                <dd className="text-on-surface text-right">{fmt(w.actual)}</dd>
                <dt className="text-outline">{t("Difference")}</dt>
                <dd className="text-error text-right">{fmt(w.difference)}</dd>
                {w.pages?.length > 0 && (
                  <>
                    <dt className="text-outline">{t("Page")}</dt>
                    <dd className="text-on-surface">{w.pages.join(", ")}</dd>
                  </>
                )}
              </dl>
              {w.level === "info" && (
                <p className="mt-2 text-on-surface-variant">{t("Informational: a related line may not have been extracted.")}</p>
              )}
            </div>
          ))}

          {report.skipped_rules?.length > 0 && (
            <details className="text-body-sm text-on-surface-variant">
              <summary className="cursor-pointer">
                {report.skipped_rules.length} {t("checks could not run (a line was not extracted)")}
              </summary>
              <ul className="mt-1 list-disc pl-5">
                {report.skipped_rules.map((s) => (
                  <li key={s.rule} className="break-words">{s.title}</li>
                ))}
              </ul>
            </details>
          )}

          <p className="text-body-sm text-on-surface-variant">
            {t("A mismatch usually means a number was misread; it is not a judgement of the company's finances.")}
          </p>
        </>
      )}
    </section>
  );
}
