import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { formatPayrollPeriod } from "../../utils/payrollPeriods.js";
import { groupIncentiveEarningsItems } from "../../utils/payrollEarningsBreakdown.js";

const PAYSLIP_DIRECTORY_PAGE_SIZE = 12;
const PAYSLIP_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const PAYSLIP_MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatPayslipPeriodOption(period) {
  const formatDate = (dateKey) =>
    PAYSLIP_DATE_FORMATTER.format(new Date(`${dateKey}T00:00:00Z`));
  return `${formatDate(period.startDate)} - ${formatDate(period.endDate)}`;
}

function formatRateTierDate(dateKey) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00Z`));
}

function getPayslipDirectorySearchText(period) {
  const start = new Date(`${period.startDate}T00:00:00Z`);
  const end = new Date(`${period.endDate}T00:00:00Z`);

  return [
    formatPayslipPeriodOption(period),
    period.startDate,
    period.endDate,
    PAYSLIP_MONTH_YEAR_FORMATTER.format(start),
    PAYSLIP_MONTH_YEAR_FORMATTER.format(end),
  ]
    .join(" ")
    .toLowerCase();
}

function getDirectoryPaginationItems(currentPage, pageCount) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = [1];
  const middleStart = Math.max(2, currentPage - 1);
  const middleEnd = Math.min(pageCount - 1, currentPage + 1);
  if (middleStart > 2) pages.push("start-ellipsis");
  for (let page = middleStart; page <= middleEnd; page += 1) {
    pages.push(page);
  }
  if (middleEnd < pageCount - 1) pages.push("end-ellipsis");
  pages.push(pageCount);
  return pages;
}

function PayslipCutoffDirectory({
  periods,
  historicalPayslips,
  formatCurrency,
  onHistoricalPayslipSelect,
  onArchivedPeriodSelect,
  setIsOpen,
  triggerRef,
}) {
  const [query, setQuery] = useState("");
  const [yearFilter, setYearFilter] = useState(() =>
    String(new Date().getFullYear()),
  );
  const [page, setPage] = useState(1);
  const searchRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusableElements = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    searchRef.current?.focus();
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [setIsOpen, triggerRef]);

  const directoryEntries = useMemo(() => {
    const snapshotsByPeriod = new Map(
      historicalPayslips
        .filter(
          (snapshot) =>
            snapshot?.period?.startDate && snapshot?.period?.endDate,
        )
        .map((snapshot) => [
          `${snapshot.period.startDate}:${snapshot.period.endDate}`,
          snapshot,
        ]),
    );

    return periods
      .filter(
        (item) =>
          item?.period?.startDate && item?.period?.endDate,
      )
      .map((item) => {
        const periodKey = `${item.period.startDate}:${item.period.endDate}`;
        return {
          ...item,
          snapshot: snapshotsByPeriod.get(periodKey) || null,
          searchText: getPayslipDirectorySearchText(item.period),
        };
      })
      .sort((left, right) =>
        right.period.endDate.localeCompare(left.period.endDate),
      );
  }, [historicalPayslips, periods]);
  const years = useMemo(
    () =>
      [
        ...new Set(
          [
            "2025",
            ...directoryEntries.map((entry) =>
              entry.period.endDate.slice(0, 4),
            ),
          ],
        ),
      ].sort((left, right) => right.localeCompare(left)),
    [directoryEntries],
  );
  const searchTokens = useMemo(
    () =>
      query
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter((token) => !["to", "through", "until"].includes(token)),
    [query],
  );
  const filteredEntries = useMemo(
    () =>
      directoryEntries.filter((entry) => {
        const matchesYear =
          yearFilter === "all" ||
          entry.period.endDate.startsWith(yearFilter);
        return (
          matchesYear &&
          searchTokens.every((token) => entry.searchText.includes(token))
        );
      }),
    [directoryEntries, searchTokens, yearFilter],
  );
  const pageCount = Math.ceil(
    filteredEntries.length / PAYSLIP_DIRECTORY_PAGE_SIZE,
  );
  const visiblePage = Math.min(page, Math.max(pageCount, 1));
  const visibleEntries = filteredEntries.slice(
    (visiblePage - 1) * PAYSLIP_DIRECTORY_PAGE_SIZE,
    visiblePage * PAYSLIP_DIRECTORY_PAGE_SIZE,
  );
  const paginationItems = getDirectoryPaginationItems(visiblePage, pageCount);
  const rangeStart =
    filteredEntries.length > 0
      ? (visiblePage - 1) * PAYSLIP_DIRECTORY_PAGE_SIZE + 1
      : 0;
  const rangeEnd = Math.min(
    visiblePage * PAYSLIP_DIRECTORY_PAGE_SIZE,
    filteredEntries.length,
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setIsOpen(false);
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payslipDirectoryTitle"
        aria-describedby="payslipDirectoryDescription"
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-teal-700">
              <Archive size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id="payslipDirectoryTitle"
                className="truncate text-sm font-bold text-slate-800"
              >
                {`Payslip Cutoff Directory (${directoryEntries.length} ${
                  directoryEntries.length === 1 ? "Record" : "Records"
                })`}
              </h2>
              <p
                id="payslipDirectoryDescription"
                className="mt-0.5 text-[10px] text-slate-500"
              >
                Search current and future cutoffs, or browse saved payslips.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close payslip cutoff directory"
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-6 md:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              aria-label="Search payslip cutoffs by date or month"
              placeholder="Search cutoff by date or month (e.g., Nov, Oct 26, 2026-11-10)..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
            />
          </label>
          <div
            className="flex max-w-full shrink-0 items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1"
            role="group"
            aria-label="Filter payslip cutoffs by year"
          >
            {years.map((year) => {
              const isSelected = yearFilter === year;
              return (
                <button
                  key={year}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setYearFilter(year);
                    setPage(1);
                  }}
                  className={`shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-semibold transition ${
                    isSelected
                      ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {year}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {visibleEntries.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleEntries.map((entry) => {
                const grossPay =
                  entry.snapshot?.summary?.recordedEarnings ?? entry.grossPay;
                const netPay = entry.snapshot?.netPay ?? entry.netPay;
                const hasPayrollTotals =
                  Number.isFinite(grossPay) && Number.isFinite(netPay);
                const status = entry.snapshot
                  ? "Saved payslip"
                  : entry.isFuture
                    ? "Incoming"
                    : entry.pendingCount > 0
                      ? "Payroll pending"
                      : entry.isCurrent
                        ? "Current Estimate"
                        : "Estimate";

                return (
                  <button
                    key={entry.period.endDate}
                    type="button"
                    onClick={() => {
                      if (entry.snapshot) {
                        onHistoricalPayslipSelect(entry.snapshot);
                      } else {
                        onArchivedPeriodSelect(entry.period.endDate);
                      }
                      setIsOpen(false);
                    }}
                    className="cutoff-card group w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
                  >
                    <div className="flex min-h-9 items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="font-bold text-slate-800">
                          {formatPayslipPeriodOption(entry.period)}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                          {entry.period.startDate.slice(0, 4) ===
                          entry.period.endDate.slice(0, 4)
                            ? entry.period.endDate.slice(0, 4)
                            : `${entry.period.startDate.slice(0, 4)}–${entry.period.endDate.slice(0, 4)}`}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-1 text-[9px] font-bold ${
                          status === "Current Estimate"
                            ? "bg-teal-50 text-teal-700"
                            : status === "Incoming"
                              ? "bg-sky-50 text-sky-700"
                              : status === "Saved payslip"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {entry.snapshot
                        ? "Saved payslip"
                        : entry.isFuture
                          ? `Payout ${PAYSLIP_DATE_FORMATTER.format(
                              new Date(`${entry.period.endDate}T00:00:00Z`),
                            )}, ${entry.period.endDate.slice(0, 4)}`
                          : entry.isCurrent
                            ? `Payout ${PAYSLIP_DATE_FORMATTER.format(
                                new Date(`${entry.period.endDate}T00:00:00Z`),
                              )}, ${entry.period.endDate.slice(0, 4)}`
                            : ""}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[10px]">
                      {hasPayrollTotals ? (
                        <>
                          <span className="text-slate-500">
                            Net pay:{" "}
                            <strong className="font-bold tabular-nums text-slate-800">
                              {formatCurrency(netPay)}
                            </strong>
                          </span>
                          <span className="text-slate-500">
                            Gross:{" "}
                            <strong className="font-bold tabular-nums text-slate-800">
                              {formatCurrency(grossPay)}
                            </strong>
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-slate-500">
                            Select to view this cutoff&apos;s estimate
                          </span>
                          <ChevronRight
                            size={13}
                            aria-hidden="true"
                            className="shrink-0 text-slate-400 transition duration-200 group-hover:translate-x-0.5 group-hover:scale-110 group-hover:text-teal-700"
                          />
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <Search
                size={20}
                aria-hidden="true"
                className="text-slate-300"
              />
              <p className="mt-2 text-xs font-semibold text-slate-700">
                No cutoffs match your search.
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                Try another date, month, or year.
              </p>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-[10px] text-slate-500 sm:px-6">
          <span>
            {`Showing ${rangeStart}–${rangeEnd} of ${filteredEntries.length} cutoffs`}
          </span>
          <nav
            aria-label="Payslip cutoff directory pagination"
            className="flex items-center gap-1"
          >
            <button
              type="button"
              disabled={visiblePage <= 1}
              onClick={() => setPage(visiblePage - 1)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={12} aria-hidden="true" />
              Previous
            </button>
            {paginationItems.map((item) =>
              typeof item === "number" ? (
                <button
                  key={item}
                  type="button"
                  aria-label={`Go to page ${item}`}
                  aria-current={item === visiblePage ? "page" : undefined}
                  onClick={() => setPage(item)}
                  className={`size-8 cursor-pointer rounded-lg border text-[10px] font-semibold transition ${
                    item === visiblePage
                      ? "border-teal-200 bg-teal-50 text-teal-700"
                      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white"
                  }`}
                >
                  {item}
                </button>
              ) : (
                <span
                  key={item}
                  aria-hidden="true"
                  className="px-1 text-slate-400"
                >
                  …
                </span>
              ),
            )}
            <button
              type="button"
              disabled={pageCount === 0 || visiblePage >= pageCount}
              onClick={() => setPage(visiblePage + 1)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight size={12} aria-hidden="true" />
            </button>
          </nav>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

export default function PayslipModal({
  open,
  userName,
  historicalPayslip,
  historicalPayslips = [],
  payslipArchivePeriods = [],
  payslipPeriodOptions,
  onPayslipPeriodChange,
  onArchivedPeriodSelect,
  onHistoricalPayslipSelect,
  payrollPeriod,
  payrollPeriodSummary,
  monthlyPayslipRange,
  monthlyPayslipGross,
  monthlyPayslipNet,
  payrollEarningsBreakdown,
  cutoffPayrollDeductions,
  payrollPeriodNetPay,
  payrollPeriodEarningsAvailable,
  pendingPayrollRecords = 0,
  dailyWage,
  formatCurrency,
  canSavePayslip,
  payslipAlreadySaved,
  payslipHistorySaving,
  onSavePayslipToHistory,
}) {
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const directoryTriggerRef = useRef(null);
  const activePeriod = historicalPayslip?.period || payrollPeriod;
  const activeSummary = historicalPayslip?.summary || payrollPeriodSummary;
  const activeBreakdown =
    historicalPayslip?.earningsBreakdown || payrollEarningsBreakdown;
  const activeDeductions =
    historicalPayslip?.deductions || cutoffPayrollDeductions;
  const activeDailyWage = historicalPayslip?.settings?.dailyWage ?? dailyWage;
  const earningsAvailable =
    Boolean(historicalPayslip) || payrollPeriodEarningsAvailable;
  const activeNetPay = historicalPayslip?.netPay ?? payrollPeriodNetPay;
  const incentiveItems = activeBreakdown.items.filter((item) =>
    item.id.startsWith("incentive-"),
  );
  const groupedIncentiveItems = groupIncentiveEarningsItems(incentiveItems);
  const groupedBreakdownItems = activeBreakdown.items.filter(
    (item) => !item.id.startsWith("incentive-"),
  );
  const basicPayRateTiers =
    groupedBreakdownItems.find((item) => item.id === "basicPay")?.rateTiers || [];
  const basicPayRateTierCount = basicPayRateTiers.length;
  const rateRevisionLabel =
    basicPayRateTierCount > 2
      ? `Rates revised ${basicPayRateTiers
          .slice(1)
          .map((tier) => formatRateTierDate(tier.effectiveDate))
          .join(", ")}`
      : basicPayRateTierCount > 1
        ? `Rate revised ${formatRateTierDate(basicPayRateTiers[1].effectiveDate)}`
        : "";
  if (incentiveItems.length > 0) {
    const incentiveGroup = {
      id: "incentives",
      label: "Incentives",
      total: incentiveItems.reduce((total, item) => total + item.total, 0),
      incentiveItems: groupedIncentiveItems,
    };
    const lateUndertimeIndex = groupedBreakdownItems.findIndex(
      (item) => item.id === "lateUndertime",
    );
    groupedBreakdownItems.splice(
      lateUndertimeIndex === -1
        ? groupedBreakdownItems.length
        : lateUndertimeIndex,
      0,
      incentiveGroup,
    );
  }
  const periodLabel = formatPayrollPeriod(activePeriod).replace(
    /\s*[–—-]\s*/,
    " - ",
  );
  const earningsLabel = earningsAvailable
    ? formatCurrency(activeSummary.recordedEarnings)
    : "Private data unavailable";
  const monthlyNetLabel = payrollPeriodEarningsAvailable
    ? formatCurrency(monthlyPayslipNet)
    : "Private data unavailable";
  const monthlyGrossLabel = payrollPeriodEarningsAvailable
    ? formatCurrency(monthlyPayslipGross)
    : "Private data unavailable";
  const monthlyRangeStart = new Date(`${monthlyPayslipRange.startDate}T00:00:00Z`);
  const monthlyRangeEnd = new Date(`${monthlyPayslipRange.endDate}T00:00:00Z`);
  const startYear = monthlyRangeStart.getUTCFullYear();
  const endYear = monthlyRangeEnd.getUTCFullYear();
  const formatRangeDate = (date, includeYear) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      ...(includeYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    }).format(date);
  const monthlyDateRangeLabel = `${formatRangeDate(
    monthlyRangeStart,
    startYear !== endYear,
  )} - ${formatRangeDate(monthlyRangeEnd, true)}`;
  const monthlyRangeDays =
    Math.round(
      (monthlyRangeEnd.getTime() - monthlyRangeStart.getTime()) /
        (24 * 60 * 60 * 1000),
    ) + 1;
  const netPayLabel = earningsAvailable
    ? formatCurrency(activeNetPay)
    : "Private data unavailable";
  useEffect(() => {
    if (!open) setIsDirectoryOpen(false);
  }, [open]);
  const recordedHours = Number.isFinite(activeSummary.actualPaidHours)
    ? activeSummary.actualPaidHours
    : activeSummary.regularHours + activeSummary.overtimeHours;
  const recordedWorkdays = Number.isFinite(activeSummary.eligibleWorkdays)
    ? `${activeSummary.eligibleWorkdays} worked day${activeSummary.eligibleWorkdays === 1 ? "" : "s"} · `
    : "";
  const formatUnits = (units) =>
    Number.isInteger(units)
      ? String(units)
      : units.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  const formatEarningsItemCalculation = (item) => {
    if (item.id === "lateUndertime") {
      return `Late/UT · Late ${formatUnits(item.lateMinutes)} min · UT ${formatUnits(item.undertimeMinutes)} min`;
    }
    if (item.units <= 0) return null;
    if (item.id === "regularHoliday" || item.id === "specialHoliday") {
      const baseWage = Number(activeDailyWage);
      if (!Number.isFinite(baseWage) || baseWage <= 0) return null;
      const basePay = baseWage * item.units;
      const premiumAmount =
        Math.round((item.total - basePay + Number.EPSILON) * 100) / 100;
      const premiumRate =
        basePay > 0 ? Math.round((premiumAmount / basePay) * 10000) / 100 : 0;
      const dayLabel = item.units === 1 ? "day" : "days";
      const basePayCalculation = `${formatUnits(item.units)} ${dayLabel} × ${formatCurrency(baseWage)}`;
      return premiumAmount > 0
        ? `${basePayCalculation} + ${formatUnits(premiumRate)}% holiday premium (${formatCurrency(premiumAmount)})`
        : `${basePayCalculation} base wage (${formatUnits(Math.round((item.rate / baseWage) * 10000) / 100)}% holiday rate)`;
    }
    const rateUnit = item.unit === "hours" ? "hour" : item.unit.slice(0, -1);
    const unitLabel =
      item.unit === "days" && item.units === 1 ? "day" : item.unit;
    return `${formatUnits(item.units)} ${unitLabel} × ${formatCurrency(item.rate)}/${rateUnit}`;
  };

  return (
    <div
      id="payslipModal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-hidden={!open || isDirectoryOpen}
      inert={isDirectoryOpen ? "" : undefined}
      style={{ display: open ? "flex" : "none" }}
    >
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl">
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <i
                className="fa-regular fa-file-lines text-lg"
                aria-hidden="true"
              ></i>
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">
                Personal earnings summary
              </span>
              <h3 className="truncate text-lg font-extrabold text-slate-900 sm:text-xl">
                {periodLabel}
              </h3>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close payslip"
            data-action="closeModal(&#x27;payslipModal&#x27;)"
            className="ml-3 shrink-0 cursor-pointer rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <i className="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
          </button>
        </div>

        {/* Modal Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-800">
              <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
              {historicalPayslip
                ? `Saved estimate snapshot · ${new Date(historicalPayslip.generatedAt).toLocaleDateString()}`
                : "Estimate only · not finalized payroll"}
            </span>
            {!historicalPayslip && (
              <div
                className="flex max-w-full flex-wrap items-center gap-2"
                role="group"
                aria-label="Active payslip period"
              >
                <div className="flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {payslipPeriodOptions.map(({ period, isCurrent }) => {
                    const isSelected =
                      activePeriod.startDate === period.startDate &&
                      activePeriod.endDate === period.endDate;
                    return (
                      <button
                        key={period.endDate}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onPayslipPeriodChange(period.endDate)}
                        className={`whitespace-nowrap cursor-pointer rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition ${
                          isSelected
                            ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200"
                            : "text-slate-600 hover:bg-white hover:text-slate-900"
                        }`}
                      >
                        {isCurrent ? "Current: " : ""}
                        {formatPayslipPeriodOption(period)}
                      </button>
                    );
                  })}
                </div>
                <button
                  ref={directoryTriggerRef}
                  type="button"
                  onClick={() => setIsDirectoryOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-[10px] font-semibold text-teal-700 transition hover:border-teal-300 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30"
                >
                  <Archive size={13} aria-hidden="true" />
                  Search &amp; Browse
                </button>
              </div>
            )}
          </div>

          {!historicalPayslip &&
            payrollPeriodEarningsAvailable &&
            pendingPayrollRecords > 0 && (
              <p
                className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900"
                role="status"
              >
                {`${pendingPayrollRecords} attendance record(s) in this pay period are incomplete and excluded from the estimate. Configure the required payroll settings or complete attendance before relying on this total.`}
              </p>
            )}

          {/* Employee Meta Grid */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [
                "Employee",
                historicalPayslip?.employeeName || userName,
                "fa-user",
              ],
              ["Pay Period", periodLabel, "fa-calendar"],
              [
                "Daily wage",
                !earningsAvailable
                  ? "Private data unavailable"
                  : Number(activeDailyWage) > 0
                    ? formatCurrency(Number(activeDailyWage))
                    : "Not set",
                "fa-coins",
              ],
              [
                "Recorded hours",
                `${recordedWorkdays}${recordedHours.toFixed(2)} hrs`,
                "fa-clock",
              ],
            ].map(([label, value, icon]) => (
              <div
                key={label}
                className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs"
              >
                <span className="flex items-center gap-1.5 text-[9px] font-bold tracking-wider text-slate-400">
                  <i
                    className={`fa-solid ${icon} text-teal-600`}
                    aria-hidden="true"
                  ></i>
                  {label}
                </span>
                {label === "Daily wage" && basicPayRateTierCount > 1 ? (
                  <div className="mt-1.5 min-w-0">
                    <span
                      className="block truncate text-xs font-bold text-slate-800"
                      title={
                        earningsAvailable
                          ? `${formatCurrency(basicPayRateTiers[0].rate)} → ${formatCurrency(basicPayRateTiers[basicPayRateTierCount - 1].rate)}`
                          : value
                      }
                    >
                      {earningsAvailable
                        ? `${formatCurrency(basicPayRateTiers[0].rate)} → ${formatCurrency(basicPayRateTiers[basicPayRateTierCount - 1].rate)}`
                        : value}
                    </span>
                    {earningsAvailable && (
                      <span className="mt-1 inline-flex max-w-full rounded-md border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[9px] font-semibold text-teal-700">
                        {rateRevisionLabel}
                      </span>
                    )}
                  </div>
                ) : (
                  <span
                    className={`mt-1.5 block truncate text-xs font-semibold text-slate-800 ${label === "Employee" ? "uppercase" : ""}`}
                    title={value}
                  >
                    {value}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Earnings & Net Pay Hero Cards */}
          <div
            className={`mb-6 grid grid-cols-1 gap-3 ${
              historicalPayslip ? "sm:grid-cols-2" : "sm:grid-cols-3"
            }`}
          >
            <div className="rounded-2xl bg-gradient-to-br from-teal-700 to-teal-600 p-5 text-white shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-100">
                Gross earnings estimate
              </span>
              <span className="mt-2 block break-words text-3xl font-extrabold tracking-tight">
                {earningsLabel}
              </span>
              <span className="mt-1 block text-[10px] text-teal-100">
                For this payroll period
              </span>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800">
                Net pay after deductions
              </span>
              <span className="mt-2 block break-words text-3xl font-extrabold tracking-tight text-emerald-700">
                {netPayLabel}
              </span>
              <span className="mt-1 block text-[10px] text-emerald-700">
                Take-Home Pay
              </span>
            </div>
            {!historicalPayslip && (
              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-800">
                  Monthly take-home
                </span>
                <span className="mt-2 block break-words text-3xl font-extrabold tracking-tight text-sky-700">
                  {monthlyNetLabel}
                </span>
                <span className="mt-1 block text-[10px] text-sky-700">
                  Gross {monthlyGrossLabel} · {monthlyDateRangeLabel} ({monthlyRangeDays} days)
                </span>
              </div>
            )}
          </div>

          {/* Breakdown Sections - Clean List Layout (No Nested Boxes) */}
          <div className="mb-6 flex flex-col gap-6">
            {/* Gross Earnings Breakdown */}
            <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center justify-between gap-3 border-b border-teal-100 bg-teal-50/70 px-4 py-3">
                <h4 className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-teal-900">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-teal-700 shadow-2xs">
                    <i
                      className="fa-solid fa-arrow-trend-up"
                      aria-hidden="true"
                    ></i>
                  </span>
                  Gross Earnings Breakdown
                </h4>
                {basicPayRateTierCount > 1 && (
                  <span className="shrink-0 rounded-full border border-teal-200 bg-white px-2.5 py-1 text-[9px] font-semibold text-teal-700">
                    Split-Rate Period ({basicPayRateTierCount} Tiers)
                  </span>
                )}
              </div>
              <div className="divide-y divide-slate-100 px-4">
                {groupedBreakdownItems.map((item) => {
                  const rateTiers = item.rateTiers || [];
                  if (item.id === "basicPay" && rateTiers.length > 1) {
                    return (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-4 py-3 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block font-medium text-slate-700">
                            Basic Pay{" "}
                            <span className="text-[10px] font-normal text-slate-500">
                              ({formatUnits(item.units)} days total)
                            </span>
                          </span>
                          <div className="mt-3 space-y-2 border-l-2 border-teal-200 pl-3">
                            {rateTiers.map((tier, index) => {
                              const dayLabel = tier.units === 1 ? "day" : "days";
                              const tierRange =
                                tier.startDate === tier.endDate
                                  ? formatRateTierDate(tier.startDate)
                                  : `${formatRateTierDate(tier.startDate)} – ${formatRateTierDate(tier.endDate)}`;
                              return (
                                <div
                                  key={`${tier.effectiveDate}:${tier.rate}`}
                                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
                                      <span>
                                        {tierRange} ·{" "}
                                        {index === 0 ? "Previous Rate" : "Revised Rate"}
                                      </span>
                                      {index > 0 && (
                                        <span className="rounded-md border border-teal-200 bg-white px-2 py-0.5 text-[9px] font-semibold text-teal-700">
                                          Effective {formatRateTierDate(tier.effectiveDate)}
                                        </span>
                                      )}
                                    </div>
                                    <span className="mt-0.5 block text-[10px] text-slate-500">
                                      {earningsAvailable
                                        ? `${formatUnits(tier.units)} ${dayLabel} × ${formatCurrency(tier.rate)}/day`
                                        : "Private"}
                                    </span>
                                  </div>
                                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                                    {earningsAvailable
                                      ? formatCurrency(tier.total)
                                      : "Private"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                          {earningsAvailable
                            ? formatCurrency(item.total)
                            : "Private"}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className={`flex justify-between gap-4 py-3 text-xs ${
                        item.id === "incentives" ? "items-start" : "items-center"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block font-medium text-slate-700">
                          {item.label}
                        </span>
                        {item.id === "incentives" && (
                          <div className="mt-0.5 space-y-0.5 pl-3 text-[10px] text-slate-400">
                            {item.incentiveItems.map((incentive) => (
                              <div key={incentive.id}>
                                {`${incentive.label} — ${incentive.count} @ ${formatCurrency(incentive.total / incentive.count)} ea (${formatCurrency(incentive.total)})`}
                              </div>
                            ))}
                          </div>
                        )}
                        {earningsAvailable &&
                          item.id !== "incentives" &&
                          formatEarningsItemCalculation(item) && (
                            <span className="mt-0.5 block text-[10px] text-slate-400">
                              {formatEarningsItemCalculation(item)}
                            </span>
                          )}
                        {item.id === "lateUndertime" && (
                          <span className="text-[10px] text-slate-400">
                            (no deduction configured)
                          </span>
                        )}
                      </div>
                      <span
                        className={`shrink-0 font-semibold tabular-nums ${
                          item.informational
                            ? "text-slate-400"
                            : "text-slate-900"
                        }`}
                      >
                        {item.informational
                          ? "Not deducted"
                          : earningsAvailable
                            ? formatCurrency(item.total)
                            : "Private"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Deductions & Contributions */}
            <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="flex items-center gap-3 border-b border-rose-100 bg-rose-50/70 px-4 py-3">
                <h4 className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-rose-900">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-rose-600 shadow-2xs">
                    <i
                      className="fa-solid fa-arrow-trend-down"
                      aria-hidden="true"
                    ></i>
                  </span>
                  Deductions &amp; Contributions
                </h4>
              </div>
              <div className="divide-y divide-slate-100 px-4">
                {activeDeductions.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4 py-3 text-xs"
                  >
                    <span className="font-medium text-slate-700">
                      {item.label} employee contribution
                    </span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {earningsAvailable
                        ? formatCurrency(item.amount)
                        : "Private"}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 py-3 text-xs font-bold bg-slate-50/50 -mx-4 px-4 border-t border-slate-200">
                  <span className="text-slate-800">
                    Total employee contributions
                  </span>
                  <span className="text-rose-700 tabular-nums">
                    {earningsAvailable
                      ? formatCurrency(
                          activeDeductions.employeeContributionTotal,
                        )
                      : "Private"}
                  </span>
                </div>
              </div>
            </section>
          </div>

          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[10px] leading-relaxed text-slate-500 shadow-2xs">
            Estimates are not finalized payroll or guaranteed legal
            entitlements. Confirm actual pay and deductions with your payroll
            administrator.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <span className="text-[10px] text-slate-400">
            {historicalPayslip
              ? "Encrypted historical snapshot"
              : "Personal payroll estimate"}
          </span>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              data-action="closeModal(&#x27;payslipModal&#x27;)"
              className="cursor-pointer rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-800"
            >
              <i className="fa-solid fa-print" aria-hidden="true"></i>
              Print summary
            </button>
            {!historicalPayslip && (
              <button
                type="button"
                disabled={
                  !canSavePayslip || payslipAlreadySaved || payslipHistorySaving
                }
                onClick={onSavePayslipToHistory}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                title={
                  !canSavePayslip
                    ? "Private financial data is not available to save this payslip"
                    : undefined
                }
              >
                <i
                  className={`fa-solid ${payslipHistorySaving ? "fa-spinner fa-spin" : payslipAlreadySaved ? "fa-check" : "fa-box-archive"}`}
                  aria-hidden="true"
                ></i>
                {payslipHistorySaving
                  ? "Saving…"
                  : payslipAlreadySaved
                    ? "Saved to history"
                    : "Save to history"}
              </button>
            )}
          </div>
        </div>
      </div>
      {open && isDirectoryOpen && (
        <PayslipCutoffDirectory
          periods={payslipArchivePeriods}
          historicalPayslips={historicalPayslips}
          formatCurrency={formatCurrency}
          onHistoricalPayslipSelect={onHistoricalPayslipSelect}
          onArchivedPeriodSelect={onArchivedPeriodSelect}
          setIsOpen={setIsDirectoryOpen}
          triggerRef={directoryTriggerRef}
        />
      )}
    </div>
  );
}
