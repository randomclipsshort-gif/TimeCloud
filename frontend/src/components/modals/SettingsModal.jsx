import React, { useEffect, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Calculator,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  DollarSign,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  calculateCutoffPayrollDeductions,
  calculateMonthlyPayrollDeductions,
  getPayrollDeductionSettingsDefaults,
  payrollContributions,
  payrollFrequencyLabels,
} from "../../utils/payrollDeductions.js";
import { getPayrollPeriodForMonth } from "../../utils/payrollPeriods.js";
import { switchPayrollBasis } from "../../utils/payrollSettingsBasis.js";
import { getExpectedPaidMinutes } from "../../utils/shiftAssignment.js";

const configurationDomains = [
  {
    id: "earnings",
    label: "Compensation & Rates",
    description: "Monthly/daily basis & multipliers",
    icon: DollarSign,
  },
  {
    id: "shiftTemplates",
    label: "Shift Templates",
    description: "12-hour schedules & break rules",
    icon: Clock3,
  },
  {
    id: "holidays",
    label: "Manage Holidays",
    description: "Toggle, edit dates & add holidays",
    icon: CalendarDays,
  },
  {
    id: "deductions",
    label: "Statutory & Allowances",
    description: "SSS, PhilHealth, Pag-IBIG & tax",
    icon: ShieldCheck,
  },
  {
    id: "general",
    label: "Employee & Budget",
    description: "Identity & cutoff spending cap",
    icon: BriefcaseBusiness,
  },
];

function formatShiftTime(value, format) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2}):([0-5]\d)(?:\s*(AM|PM))?$/i);
  if (!match) return value || "—";

  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3]?.toUpperCase();
  if (meridiem) hour = (hour % 12) + (meridiem === "PM" ? 12 : 0);

  if (format === "24h") {
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }
  const period = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minute} ${period}`;
}

export default function SettingsModal({
  open,
  activeSettingsTab,
  holidays,
  selectedLocality,
  holidayEligibilityConfirmed,
  settingsBalances,
  dailyWage,
  dailyAllowance,
  overtimeMultiplier,
  payrollSettings,
  nightDifferential,
  payrollEffectiveDate,
  onDeleteAccount,
  accountDeletionLoading,
  onSaveSettings,
  privateFinancialDataStatus,
  privateFinancialDataError,
  privateFinancialDataConflict,
  privateFinancialDataSyncing,
  legacySalaryVaultAvailable,
  shiftTemplates,
  onMigrateLegacySalaryVault,
  onReloadPrivateFinancialData,
  onSettingsValidationError,
  onCreateShiftTemplate,
  onSetDefaultShiftTemplate,
  onDeleteShiftTemplate,
}) {
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayType, setHolidayType] = useState("special-non-working");
  const [legacyVaultPassphrase, setLegacyVaultPassphrase] = useState("");
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationError, setMigrationError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [holidaySearchQuery, setHolidaySearchQuery] = useState("");
  const [holidayFilterType, setHolidayFilterType] = useState("ALL");
  const [holidayFormOpen, setHolidayFormOpen] = useState(true);
  const [editingHolidayDateId, setEditingHolidayDateId] = useState(null);
  const [newShiftName, setNewShiftName] = useState("");
  const [newShiftStartTime, setNewShiftStartTime] = useState("09:00");
  const [newShiftEndTime, setNewShiftEndTime] = useState("18:00");
  const [newShiftBreakMinutes, setNewShiftBreakMinutes] = useState("60");
  const previousPrivateFinancialDataStatus = useRef(privateFinancialDataStatus);

  useEffect(() => {
    if (!open) {
      setSettingsDraft(null);
      setLegacyVaultPassphrase("");
      setMigrationError("");
      setSettingsSaving(false);
      setEditingHolidayDateId(null);
      return;
    }
    setSettingsDraft({
      holidays: holidays.map((holiday) => ({ ...holiday })),
      selectedLocality,
      holidayEligibilityConfirmed,
      dailyWage,
      dailyAllowance,
      workingDaysFactor: payrollSettings?.workingDaysFactor ?? "26",
      payrollBasis: payrollSettings?.payrollBasis ?? "daily",
      monthlySalary:
        Number(payrollSettings?.monthlySalary) > 0
          ? payrollSettings.monthlySalary
          : String(
              (Number(dailyWage) || 0) *
                (Number(payrollSettings?.workingDaysFactor) || 26),
            ),
      overtimeMultiplier,
      regularHolidayMultiplier:
        payrollSettings?.regularHolidayMultiplier ?? "2",
      specialHolidayMultiplier:
        payrollSettings?.specialHolidayMultiplier ?? "1.3",
      shiftTimeFormat: payrollSettings?.shiftTimeFormat ?? "24h",
      ...getPayrollDeductionSettingsDefaults(payrollSettings),
      nightDifferential,
      payrollEffectiveDate,
      settingsBalances: { ...settingsBalances },
    });
  }, [open]);

  useEffect(() => {
    const wasWaitingForPrivateData =
      previousPrivateFinancialDataStatus.current !== "ready";
    previousPrivateFinancialDataStatus.current = privateFinancialDataStatus;
    if (
      !open ||
      !wasWaitingForPrivateData ||
      privateFinancialDataStatus !== "ready"
    ) {
      return;
    }

    setSettingsDraft((current) =>
      current
        ? {
            ...current,
            dailyWage,
            dailyAllowance,
            workingDaysFactor: payrollSettings?.workingDaysFactor ?? "26",
            payrollBasis: payrollSettings?.payrollBasis ?? "daily",
            monthlySalary:
              Number(payrollSettings?.monthlySalary) > 0
                ? payrollSettings.monthlySalary
                : String(
                    (Number(dailyWage) || 0) *
                      (Number(payrollSettings?.workingDaysFactor) || 26),
                  ),
            overtimeMultiplier,
            regularHolidayMultiplier:
              payrollSettings?.regularHolidayMultiplier ?? "2",
            specialHolidayMultiplier:
              payrollSettings?.specialHolidayMultiplier ?? "1.3",
            shiftTimeFormat: payrollSettings?.shiftTimeFormat ?? "24h",
            ...getPayrollDeductionSettingsDefaults(payrollSettings),
            nightDifferential,
          }
        : current,
    );
  }, [
    open,
    privateFinancialDataStatus,
    dailyWage,
    dailyAllowance,
    overtimeMultiplier,
    payrollSettings,
    nightDifferential,
  ]);

  const updateDraft = (key, value) => {
    setSettingsDraft((current) => ({ ...current, [key]: value }));
  };
  const addShiftPreset = (event) => {
    event.preventDefault();
    const created = onCreateShiftTemplate({
      name: newShiftName.trim(),
      startTime: newShiftStartTime,
      endTime: newShiftEndTime,
      breakDurationMinutes: Number(newShiftBreakMinutes),
    });
    if (!created) return;
    setNewShiftName("");
    setNewShiftStartTime("09:00");
    setNewShiftEndTime("18:00");
    setNewShiftBreakMinutes("60");
  };
  const setPayrollBasis = (payrollBasis) => {
    if (payrollBasis === "monthly") return;
    setSettingsDraft((current) => switchPayrollBasis(current, payrollBasis));
  };
  const updateWorkingDaysFactor = (value) => {
    setSettingsDraft((current) => {
      const workingDays = Number(value);
      const monthlySalary = Number(current.monthlySalary);
      return {
        ...current,
        workingDaysFactor: value,
        ...(current.payrollBasis === "monthly" &&
        Number.isFinite(workingDays) &&
        workingDays > 0 &&
        Number.isFinite(monthlySalary)
          ? { dailyWage: String(monthlySalary / workingDays) }
          : {}),
      };
    });
  };
  const updateMonthlySalary = (value) => {
    setSettingsDraft((current) => {
      const monthlySalary = Number(value);
      const workingDays = Number(current.workingDaysFactor);
      return {
        ...current,
        monthlySalary: value,
        ...(current.payrollBasis === "monthly" &&
        Number.isFinite(monthlySalary) &&
        Number.isFinite(workingDays) &&
        workingDays > 0
          ? { dailyWage: String(monthlySalary / workingDays) }
          : {}),
      };
    });
  };
  if (!settingsDraft) return null;

  const activeDomain = configurationDomains.find(
    (domain) => domain.id === activeSettingsTab,
  );
  const formatSummaryAmount = (value) =>
    `₱${(Number(value) || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  const basisDailyRate =
    settingsDraft.payrollBasis === "monthly"
      ? (Number(settingsDraft.monthlySalary) || 0) /
        (Number(settingsDraft.workingDaysFactor) || 26)
      : Number(settingsDraft.dailyWage) || 0;
  const basisAllowance = Number(settingsDraft.dailyAllowance) || 0;
  const parsedWorkingDays = Number(settingsDraft.workingDaysFactor);
  const basisWorkingDays =
    Number.isInteger(parsedWorkingDays) && parsedWorkingDays > 0
      ? parsedWorkingDays
      : 0;
  const basisHourlyRate = basisDailyRate / 8;
  const basisMonthlyRate = (basisDailyRate + basisAllowance) * basisWorkingDays;
  const summaryMonthlyDeductions = calculateMonthlyPayrollDeductions({
    month: payrollEffectiveDate.slice(0, 7),
    mode: settingsDraft.payrollDeductionMode,
    monthlyGrossPay: basisMonthlyRate,
    manualPerPaycheck: {
      sss: settingsDraft.manualSssPerPaycheck,
      philHealth: settingsDraft.manualPhilHealthPerPaycheck,
      pagIbig: settingsDraft.manualPagIbigPerPaycheck,
    },
    settings: settingsDraft,
  });
  const deductionCutoffs = [10, 25].map((cutoffDay) =>
    calculateCutoffPayrollDeductions({
      period: getPayrollPeriodForMonth(
        payrollEffectiveDate.slice(0, 7),
        cutoffDay,
      ),
      mode: settingsDraft.payrollDeductionMode,
      monthlyGrossPay: basisMonthlyRate,
      manualPerPaycheck: {
        sss: settingsDraft.manualSssPerPaycheck,
        philHealth: settingsDraft.manualPhilHealthPerPaycheck,
        pagIbig: settingsDraft.manualPagIbigPerPaycheck,
      },
      settings: settingsDraft,
    }),
  );
  const getDeductionAtCutoff = (id, index) =>
    Number(
      deductionCutoffs[index]?.items?.find((item) => item.id === id)?.amount ||
        0,
    );
  const payrollHistory = Array.isArray(payrollSettings?.payrollSettingsHistory)
    ? payrollSettings.payrollSettingsHistory
    : [];
  const previousDailyRate =
    payrollHistory.length > 1
      ? payrollHistory[payrollHistory.length - 2]?.settings?.dailyWage
      : payrollHistory[0]?.settings?.dailyWage;
  const previousPayrollSettings =
    payrollHistory.length > 1
      ? payrollHistory[payrollHistory.length - 2]?.settings
      : payrollHistory[0]?.settings;
  const previousBasisRate = previousPayrollSettings
    ? settingsDraft.payrollBasis === "monthly"
      ? previousPayrollSettings.payrollBasis === "monthly"
        ? previousPayrollSettings.monthlySalary
        : String(
            (Number(previousPayrollSettings.dailyWage) || 0) *
              (Number(previousPayrollSettings.workingDaysFactor) || 26),
          )
      : previousPayrollSettings.payrollBasis === "monthly"
        ? String(
            (Number(previousPayrollSettings.monthlySalary) || 0) /
              (Number(previousPayrollSettings.workingDaysFactor) || 26),
          )
        : previousPayrollSettings.dailyWage
    : previousDailyRate;
  const baseRateForSummary =
    settingsDraft.payrollBasis === "monthly"
      ? settingsDraft.monthlySalary
      : basisDailyRate;
  const filteredHolidays = settingsDraft.holidays.filter((holiday) => {
    const query = holidaySearchQuery.trim().toLocaleLowerCase();
    const classification = String(
      holiday.classification || holiday.type || "",
    ).toLocaleLowerCase();
    const matchesType =
      holidayFilterType === "ALL" ||
      (holidayFilterType === "REGULAR" &&
        classification.includes("regular holiday")) ||
      (holidayFilterType === "SPECIAL" && classification.includes("special"));
    const matchesQuery =
      !query ||
      [
        holiday.name,
        holiday.description,
        holiday.locality,
        holiday.date,
        holiday.classification,
        holiday.type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(query));
    return matchesType && matchesQuery;
  });
  const regularHolidayCount = settingsDraft.holidays.filter((holiday) =>
    String(holiday.classification || holiday.type || "")
      .toLocaleLowerCase()
      .includes("regular holiday"),
  ).length;
  const specialHolidayCount = settingsDraft.holidays.filter((holiday) =>
    String(holiday.classification || holiday.type || "")
      .toLocaleLowerCase()
      .includes("special"),
  ).length;
  const supportedHolidayClassifications = new Set([
    "Regular Holiday",
    "Special Non-Working Day",
    "Special Working Day",
  ]);
  const isSupportedHolidayClassification = (holiday) =>
    supportedHolidayClassifications.has(
      String(holiday.classification || holiday.type || ""),
    );

  const handleMigrateLegacyVault = async (event) => {
    event.preventDefault();
    setMigrationLoading(true);
    setMigrationError("");
    try {
      await onMigrateLegacySalaryVault(legacyVaultPassphrase);
      setLegacyVaultPassphrase("");
    } catch (error) {
      setMigrationError(
        error instanceof Error
          ? error.message
          : "Unable to migrate existing private financial data.",
      );
    } finally {
      setMigrationLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    const workingDaysFactor = Number(settingsDraft.workingDaysFactor);
    if (
      !Number.isInteger(workingDaysFactor) ||
      workingDaysFactor < 1 ||
      workingDaysFactor > 31
    ) {
      onSettingsValidationError(
        "Working days factor must be a whole number between 1 and 31.",
      );
      return;
    }
    if (
      settingsDraft.payrollBasis === "monthly" &&
      (!Number.isFinite(Number(settingsDraft.monthlySalary)) ||
        Number(settingsDraft.monthlySalary) <= 0)
    ) {
      onSettingsValidationError("Enter a monthly salary greater than zero.");
      return;
    }
    if (
      settingsDraft.payrollBasis === "daily" &&
      (!Number.isFinite(Number(settingsDraft.dailyWage)) ||
        Number(settingsDraft.dailyWage) <= 0)
    ) {
      onSettingsValidationError("Enter a daily rate greater than zero.");
      return;
    }
    if (
      [
        "overtimeMultiplier",
        "regularHolidayMultiplier",
        "specialHolidayMultiplier",
      ].some((key) => {
        const value = Number(settingsDraft[key]);
        return !Number.isFinite(value) || value <= 0;
      })
    ) {
      onSettingsValidationError(
        "Payroll multipliers must be greater than zero.",
      );
      return;
    }

    const invalidAmount = payrollContributions.some(
      ({ id, manualAmountKey }) => {
        const frequency = settingsDraft[`${id}Frequency`];
        const amountKeys = [];
        if (
          settingsDraft.payrollDeductionMode === "manual" &&
          frequency !== "custom"
        ) {
          amountKeys.push(manualAmountKey);
        }
        if (frequency === "custom") {
          amountKeys.push(`${id}FirstCutoffAmount`, `${id}SecondCutoffAmount`);
        }
        return amountKeys.some((key) => {
          const amount = Number(settingsDraft[key]);
          return !Number.isFinite(amount) || amount < 0;
        });
      },
    );
    if (invalidAmount) {
      onSettingsValidationError(
        "Contribution amounts must be zero or greater.",
      );
      return;
    }
    if (
      payrollContributions.some(({ id }) => {
        const frequency = settingsDraft[`${id}Frequency`];
        const monthlyCutoff = settingsDraft[`${id}MonthlyCutoff`];
        return (
          !Object.hasOwn(payrollFrequencyLabels, frequency) ||
          (frequency === "monthly" &&
            !["10", "25"].includes(String(monthlyCutoff)))
        );
      })
    ) {
      onSettingsValidationError(
        "Choose a valid contribution frequency and monthly cutoff.",
      );
      return;
    }
    setSettingsSaving(true);
    try {
      await onSaveSettings({
        ...settingsDraft,
        holidays: settingsDraft.holidays.map((holiday) =>
          isSupportedHolidayClassification(holiday)
            ? holiday
            : { ...holiday, enabled: false },
        ),
      });
    } catch {
      setMigrationError("Settings could not be saved.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleAddHoliday = (event) => {
    event.preventDefault();
    const typeDetails = {
      "regular-holiday": { classification: "Regular Holiday" },
      "special-non-working": { classification: "Special Non-Working Day" },
      "special-working": { classification: "Special Working Day" },
    }[holidayType];
    const name = holidayName.trim();
    const parsedDate = new Date(`${holidayDate}T00:00:00`);
    const validDate =
      /^\d{4}-\d{2}-\d{2}$/.test(holidayDate) &&
      !Number.isNaN(parsedDate.getTime()) &&
      `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}` ===
        holidayDate;

    if (
      !name ||
      !validDate ||
      !typeDetails ||
      ![
        "Regular Holiday",
        "Special Non-Working Day",
        "Special Working Day",
      ].includes(typeDetails.classification) ||
      settingsDraft.holidays.some((holiday) => holiday.date === holidayDate)
    ) {
      if (!name || !validDate) {
        onSettingsValidationError("Enter a holiday name and a valid date.");
      } else if (!typeDetails) {
        onSettingsValidationError("Choose a valid holiday type.");
      } else if (
        ![
          "Regular Holiday",
          "Special Non-Working Day",
          "Special Working Day",
        ].includes(typeDetails.classification)
      ) {
        onSettingsValidationError(
          "This holiday classification is unavailable.",
        );
      } else {
        onSettingsValidationError(
          "A holiday is already configured for that date.",
        );
      }
      return;
    }

    updateDraft("holidays", [
      ...settingsDraft.holidays,
      {
        id: `holiday-${holidayDate}-${Date.now()}`,
        date: holidayDate,
        name,
        ...typeDetails,
        enabled: true,
        custom: true,
      },
    ]);
    setHolidayName("");
    setHolidayDate("");
    setHolidayType("special-non-working");
    setHolidayFormOpen(false);
  };

  const updateHolidayDate = (holidayId, date) => {
    const parsedDate = new Date(`${date}T00:00:00`);
    const validDate =
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !Number.isNaN(parsedDate.getTime()) &&
      `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}` ===
        date;
    if (!validDate) {
      onSettingsValidationError("Enter a valid holiday date.");
      return;
    }
    if (
      settingsDraft.holidays.some(
        (holiday) => holiday.id !== holidayId && holiday.date === date,
      )
    ) {
      onSettingsValidationError(
        "A holiday is already configured for that date.",
      );
      return;
    }
    updateDraft(
      "holidays",
      settingsDraft.holidays.map((holiday) =>
        holiday.id === holidayId ? { ...holiday, date } : holiday,
      ),
    );
  };

  const isCustomHoliday = (holiday) =>
    holiday.custom === true || String(holiday.id || "").startsWith("holiday-");

  const deleteCustomHoliday = (holidayId) => {
    updateDraft(
      "holidays",
      settingsDraft.holidays.filter((holiday) => holiday.id !== holidayId),
    );
  };

  return (
    <div
      id="settingsModal"
      className="settings-modal fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 hidden flex items-center justify-center p-2"
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      style={{ display: open ? "flex" : "none" }}
    >
      <div
        className="flex h-[90vh] max-h-[calc(100vh-12px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl"
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
              <SlidersHorizontal size={19} aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight text-slate-900">
                  Settings Configuration
                </h3>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Timekeep Cloud
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Configure compensation rules, shift templates, and Philippine
                statutory parameters.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close modal"
            data-action="closeModal(&#x27;settingsModal&#x27;)"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[28%_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-slate-200 bg-slate-50/80 p-4 md:border-b-0 md:border-r md:p-5">
            <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Configuration domains
            </p>
            <nav
              aria-label="Configuration domains"
              className="flex min-w-0 gap-2 overflow-x-auto pb-2 md:block md:space-y-1 md:overflow-visible md:pb-0"
            >
              {configurationDomains.map((domain) => {
                const Icon = domain.icon;
                const isSelected = domain.id === activeSettingsTab;
                return (
                  <button
                    key={domain.id}
                    type="button"
                    aria-current={isSelected ? "page" : undefined}
                    data-action={`switchSettingsTab('${domain.id}')`}
                    className={`flex w-[11rem] shrink-0 items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 md:w-full ${
                      isSelected
                        ? "border-emerald-300 bg-emerald-50/70 text-emerald-900 shadow-sm"
                        : "border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-white"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isSelected
                            ? "bg-emerald-700 text-white"
                            : "bg-slate-200/70 text-slate-500"
                        }`}
                      >
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold">
                          {domain.label}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-tight text-slate-500">
                          {domain.description}
                        </span>
                      </span>
                    </span>
                    {isSelected && (
                      <ChevronRight
                        size={16}
                        className="shrink-0 text-emerald-700"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
            <section
              className="mt-4 hidden rounded-xl border border-slate-200 bg-white p-4 md:block"
              aria-labelledby="activeConfigSummary"
            >
              <div className="mb-3 flex items-center justify-between">
                <h4
                  id="activeConfigSummary"
                  className="text-[10px] font-bold uppercase tracking-wide text-slate-700"
                >
                  Active config summary
                </h4>
                <span
                  className={`h-2 w-2 rounded-full ${
                    privateFinancialDataStatus === "ready"
                      ? "bg-teal-600"
                      : "bg-amber-500"
                  }`}
                  aria-label={
                    privateFinancialDataStatus === "ready"
                      ? "Configuration ready"
                      : "Configuration needs attention"
                  }
                />
              </div>
              <dl className="space-y-2 text-[11px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Pay Structure</dt>
                  <dd className="font-semibold text-slate-800">
                    {settingsDraft.payrollBasis === "monthly"
                      ? "Fixed Monthly"
                      : "Daily Basis"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-slate-100 pt-2">
                  <dt className="text-slate-500">Base Rate</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatSummaryAmount(baseRateForSummary)}
                    {settingsDraft.payrollBasis === "monthly" ? " / mo" : ""}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-slate-100 pt-2">
                  <dt className="text-slate-500">OT Multiplier</dt>
                  <dd className="font-semibold text-teal-700">
                    {Number(settingsDraft.overtimeMultiplier) || 0}x
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-slate-100 pt-2">
                  <dt className="text-slate-500">Monthly Statutory</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatSummaryAmount(summaryMonthlyDeductions.total)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-slate-100 pt-2">
                  <dt className="text-slate-500">Shift Presets</dt>
                  <dd className="font-semibold text-slate-800">
                    {shiftTemplates?.length || 0} Active
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-t border-slate-100 pt-2">
                  <dt className="text-slate-500">Active Holidays</dt>
                  <dd className="font-semibold text-teal-700">
                    {`${settingsDraft.holidays.filter((holiday) => holiday.enabled).length} of ${settingsDraft.holidays.length}`}
                  </dd>
                </div>
              </dl>
            </section>
          </aside>
          <main className="flex-1 min-h-0 min-w-0 flex-col">
            {activeSettingsTab !== "shiftTemplates" && (
              <div
                className="shrink-0 pt-5"
              >
                <div
                  className={
                    activeSettingsTab === "deductions"
                      ? "mx-5 flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:mx-7 sm:flex-row sm:items-center"
                      : `mx-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 ${
                          activeSettingsTab === "earnings" ? "pb-4" : "pb-3"
                        } sm:mx-7`
                  }
                >
                  <div>
                    <h4
                      className={`font-bold text-slate-900 ${
                        activeSettingsTab === "earnings"
                          ? "text-base"
                          : "text-lg"
                      }`}
                    >
                      {activeSettingsTab === "earnings"
                        ? "Compensation & Overtime Multipliers"
                        : activeDomain?.label || "Settings"}
                    </h4>
                    <p
                      className={`text-xs text-slate-500 ${
                        activeSettingsTab === "earnings" ? "mt-0.5" : "mt-1"
                      }`}
                    >
                      {activeSettingsTab === "earnings"
                        ? "Define base salary computation and premium rates for overtime and holidays."
                        : activeSettingsTab === "holidays"
                          ? "Toggle, update, and add holidays used in attendance and payroll calculations."
                          : activeSettingsTab === "deductions"
                            ? "Configure semi-monthly deduction schedules, amounts, and leave credits."
                            : "Manage account privacy, employee preferences, and your workspace settings."}
                    </p>
                  </div>
                  {activeSettingsTab === "holidays" && (
                    <span className="shrink-0 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-[10px] font-semibold text-teal-700">
                      {`${settingsDraft.holidays.filter((holiday) => holiday.enabled).length} of ${settingsDraft.holidays.length} active`}
                    </span>
                  )}
                  {activeSettingsTab === "deductions" && (
                    <div
                      role="group"
                      aria-label="Contribution amount mode"
                      className="inline-flex min-h-10 min-w-[15.25rem] shrink-0 justify-between rounded-xl border border-slate-200 bg-slate-100 p-1"
                    >
                      {[
                        {
                          value: "manual",
                          label: "Configured Amounts",
                        },
                        { value: "automatic", label: "Auto-Estimate" },
                      ].map((mode) => (
                        <button
                          key={mode.value}
                          type="button"
                          aria-pressed={
                            settingsDraft.payrollDeductionMode === mode.value
                          }
                          disabled={privateFinancialDataStatus !== "ready"}
                          onClick={() =>
                            updateDraft("payrollDeductionMode", mode.value)
                          }
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            settingsDraft.payrollDeductionMode === mode.value
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div
              className={`min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-7 ${
                activeSettingsTab === "shiftTemplates" ? "pt-5" : "pt-3"
              }`}
            >
              <div
                id="settingsTabEarnings"
                className={
                  activeSettingsTab === "earnings"
                    ? "flex min-h-full flex-col text-xs"
                    : "hidden"
                }
              >
                {activeSettingsTab === "earnings" && (
                  <>
                    {privateFinancialDataStatus !== "ready" && (
                      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[11px] leading-relaxed text-amber-900">
                        <i
                          className="fa-solid fa-lock mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          {privateFinancialDataStatus === "migration-required"
                            ? "Migrate your existing salary vault in General Preferences to continue editing private financial data."
                            : privateFinancialDataStatus === "unavailable"
                              ? "Private financial storage is not configured on this server."
                              : "Private financial data is not available. Retry loading cloud data before editing these settings."}
                        </span>
                      </div>
                    )}
                    <section
                      className="flex flex-1 flex-col gap-4"
                      aria-labelledby="earningsRatesHeading"
                    >
                      <h5
                        id="earningsRatesHeading"
                        className="text-xs font-medium uppercase tracking-wide text-slate-600"
                      >
                        Compensation calculation basis
                      </h5>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          aria-pressed={
                            settingsDraft.payrollBasis === "monthly"
                          }
                          disabled
                          className="cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-500 opacity-60"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span>Fixed Monthly Salary</span>
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              Unavailable
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-pressed={settingsDraft.payrollBasis === "daily"}
                          onClick={() => setPayrollBasis("daily")}
                          disabled={privateFinancialDataStatus !== "ready"}
                          className={`rounded-xl border px-4 py-2.5 text-xs transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                            settingsDraft.payrollBasis === "daily"
                              ? "border-emerald-400 bg-emerald-50 font-semibold text-emerald-800"
                              : "border-slate-200 bg-white font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
                          }`}
                        >
                          Daily Rate Attendance
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <label className="block">
                          <span className="mb-2 block text-xs font-medium text-slate-700">
                            Previous{" "}
                            {settingsDraft.payrollBasis === "monthly"
                              ? "Monthly Salary"
                              : "Daily Rate"}
                          </span>
                          <div className="relative">
                            <span
                              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-slate-400"
                              aria-hidden="true"
                            >
                              ₱
                            </span>
                            <input
                              type="number"
                              disabled
                              value={previousBasisRate ?? ""}
                              className="settings-number-input w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-7 pr-3 text-xs font-normal text-slate-700"
                            />
                          </div>
                        </label>
                        <label className="block">
                          <span className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-emerald-800">
                            Revised{" "}
                            {settingsDraft.payrollBasis === "monthly"
                              ? "Monthly Salary"
                              : "Daily Rate"}
                            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                              Active
                            </span>
                          </span>
                          <div className="relative">
                            <span
                              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-emerald-700"
                              aria-hidden="true"
                            >
                              ₱
                            </span>
                            <input
                              type="number"
                              id={
                                settingsDraft.payrollBasis === "monthly"
                                  ? "settingMonthlySalary"
                                  : "settingBaseWage"
                              }
                              min="0.01"
                              step="0.01"
                              disabled={privateFinancialDataStatus !== "ready"}
                              value={
                                settingsDraft.payrollBasis === "monthly"
                                  ? settingsDraft.monthlySalary
                                  : settingsDraft.dailyWage
                              }
                              onChange={(event) =>
                                settingsDraft.payrollBasis === "monthly"
                                  ? updateMonthlySalary(event.target.value)
                                  : updateDraft("dailyWage", event.target.value)
                              }
                              className="settings-number-input w-full rounded-xl border border-emerald-400 bg-white py-2.5 pl-7 pr-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-300"
                            />
                          </div>
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-xs font-medium text-slate-700">
                            Settings Effective Date
                          </span>
                          <input
                            type="date"
                            id="payrollSettingsEffectiveDate"
                            required
                            disabled={privateFinancialDataStatus !== "ready"}
                            value={settingsDraft.payrollEffectiveDate}
                            onChange={(event) =>
                              updateDraft(
                                "payrollEffectiveDate",
                                event.target.value,
                              )
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-normal text-slate-800 outline-none focus:ring-2 focus:ring-teal-400"
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 flex h-6 items-center text-xs font-medium text-slate-700">
                            Company Allowance · Daily
                          </span>
                          <div className="relative">
                            <span
                              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-slate-400"
                              aria-hidden="true"
                            >
                              ₱
                            </span>
                            <input
                              type="number"
                              id="settingDailyAllowance"
                              min="0"
                              step="0.01"
                              disabled={privateFinancialDataStatus !== "ready"}
                              value={settingsDraft.dailyAllowance}
                              onChange={(event) =>
                                updateDraft(
                                  "dailyAllowance",
                                  event.target.value,
                                )
                              }
                              className="settings-number-input w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-7 pr-3 text-xs font-normal text-slate-800 outline-none focus:ring-2 focus:ring-teal-400"
                            />
                          </div>
                        </label>
                        <div>
                          <div className="mb-2 flex h-6 items-center justify-between gap-2">
                            <span className="text-xs font-medium text-slate-700">
                              Working Days Factor / Month
                            </span>
                            <span className="shrink-0 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-medium text-emerald-700">
                              Monthly Divisor
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              id="settingWorkingDaysFactor"
                              min="1"
                              max="31"
                              step="1"
                              disabled={privateFinancialDataStatus !== "ready"}
                              value={settingsDraft.workingDaysFactor}
                              onChange={(event) =>
                                updateWorkingDaysFactor(event.target.value)
                              }
                              className="settings-number-input w-full rounded-xl border border-emerald-400 bg-white px-3 py-2.5 pr-12 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-300"
                            />
                            <span
                              className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400"
                              aria-hidden="true"
                            >
                              days
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="min-h-[72px] rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                        <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                            <Calculator size={14} aria-hidden="true" />
                          </span>
                          <div>
                            <p className="text-xs font-bold leading-4 text-slate-900">
                              Live Statutory Rate Equivalent
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-700">
                              ₱
                              {basisDailyRate.toLocaleString("en-PH", {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })}{" "}
                              ÷ 8 hrs = ₱
                              {basisHourlyRate.toLocaleString("en-PH", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                              /hr base rate
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-semibold leading-4 text-emerald-700">
                              Est. Monthly Gross ({basisWorkingDays}d):
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-900">
                              ₱
                              {basisMonthlyRate.toLocaleString("en-PH", {
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </div>
                      </div>

                      <section className="space-y-3 border-t border-slate-100 pt-3">
                        <h5 className="text-xs font-medium uppercase tracking-wide text-slate-600">
                          Overtime &amp; Holiday Multipliers
                        </h5>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <label className="block min-w-0">
                            <span className="mb-2 flex h-6 items-center text-xs font-medium text-slate-700">
                              Regular Holiday Rate
                            </span>
                            <div className="relative">
                              <input
                                type="number"
                                id="settingRegularHolidayMultiplier"
                                min="0.01"
                                step="0.1"
                                disabled={
                                  privateFinancialDataStatus !== "ready"
                                }
                                value={settingsDraft.regularHolidayMultiplier}
                                onChange={(event) =>
                                  updateDraft(
                                    "regularHolidayMultiplier",
                                    event.target.value,
                                  )
                                }
                                className="settings-number-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                              />
                              <span
                                className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400"
                                aria-hidden="true"
                              >
                                x
                              </span>
                            </div>
                          </label>
                          <label className="block min-w-0">
                            <span className="mb-2 flex h-6 items-center text-xs font-medium text-slate-700">
                              Special Holiday Rate
                            </span>
                            <div className="relative">
                              <input
                                type="number"
                                id="settingSpecialHolidayMultiplier"
                                min="0.01"
                                step="0.1"
                                disabled={
                                  privateFinancialDataStatus !== "ready"
                                }
                                value={settingsDraft.specialHolidayMultiplier}
                                onChange={(event) =>
                                  updateDraft(
                                    "specialHolidayMultiplier",
                                    event.target.value,
                                  )
                                }
                                className="settings-number-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                              />
                              <span
                                className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400"
                                aria-hidden="true"
                              >
                                x
                              </span>
                            </div>
                          </label>
                          <label className="block min-w-0">
                            <span className="mb-2 flex h-6 items-center text-xs font-medium text-slate-700">
                              Regular OT Multiplier
                            </span>
                            <div className="relative">
                              <input
                                type="number"
                                id="settingOtMultiplier"
                                min="0.01"
                                step="0.05"
                                disabled={
                                  privateFinancialDataStatus !== "ready"
                                }
                                value={settingsDraft.overtimeMultiplier}
                                onChange={(event) =>
                                  updateDraft(
                                    "overtimeMultiplier",
                                    event.target.value,
                                  )
                                }
                                className="settings-number-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                              />
                              <span
                                className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400"
                                aria-hidden="true"
                              >
                                x
                              </span>
                            </div>
                          </label>
                          <label className="block min-w-0">
                            <span className="mb-2 flex h-6 items-center text-xs font-medium text-slate-700">
                              Night Differential
                            </span>
                            <div className="relative">
                              <input
                                type="number"
                                id="settingNightDiff"
                                min="0"
                                step="0.1"
                                disabled={
                                  privateFinancialDataStatus !== "ready"
                                }
                                value={settingsDraft.nightDifferential}
                                onChange={(event) =>
                                  updateDraft(
                                    "nightDifferential",
                                    event.target.value,
                                  )
                                }
                                className="settings-number-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                              />
                              <span
                                className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400"
                                aria-hidden="true"
                              >
                                %
                              </span>
                            </div>
                          </label>
                        </div>
                      </section>
                    </section>
                  </>
                )}
              </div>
              <div
                id="settingsTabShiftTemplates"
                className={
                  activeSettingsTab === "shiftTemplates"
                    ? "flex min-h-full flex-col gap-6 text-xs"
                    : "hidden"
                }
              >
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      Shift Templates &amp; Default Schedule
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Manage reusable shift blocks displayed across the
                      statutory calendar.
                    </p>
                  </div>
                  <div
                    className="inline-flex min-h-10 min-w-[15.25rem] self-start justify-between rounded-xl border border-slate-200 bg-slate-100 p-1 sm:self-center"
                    role="group"
                    aria-label="Shift time display format"
                  >
                    {[
                      ["24h", "24-Hour"],
                      ["12h", "12-Hour"],
                    ].map(([format, label]) => (
                      <button
                        key={format}
                        type="button"
                        aria-pressed={settingsDraft.shiftTimeFormat === format}
                        disabled={privateFinancialDataStatus !== "ready"}
                        onClick={() => updateDraft("shiftTimeFormat", format)}
                        className={`flex-1 rounded-lg px-3 py-1.5 text-center text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          settingsDraft.shiftTimeFormat === format
                            ? "bg-white text-emerald-800 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {shiftTemplates?.length ? (
                    shiftTemplates.map((template, index) => {
                      const hasScheduledTime =
                        template.startTime && template.endTime;
                      const expectedPaidMinutes =
                        getExpectedPaidMinutes(template);
                      const rawBreakMinutes = template.breakDurationMinutes;
                      const hasBreakDuration =
                        rawBreakMinutes !== null &&
                        rawBreakMinutes !== undefined &&
                        rawBreakMinutes !== "" &&
                        Number.isFinite(Number(rawBreakMinutes));
                      const breakSummary = hasBreakDuration
                        ? `${Number(rawBreakMinutes)}m break`
                        : "Break not configured";
                      const netHoursSummary =
                        expectedPaidMinutes === null
                          ? ""
                          : ` (${
                              expectedPaidMinutes % 60 === 0
                                ? expectedPaidMinutes / 60
                                : (expectedPaidMinutes / 60).toFixed(2)
                            }h net)`;
                      return (
                        <div
                          key={template.id}
                          className={`flex flex-col justify-between gap-3 p-4 transition-colors sm:flex-row sm:items-center ${
                            index > 0 ? "border-t border-slate-200" : ""
                          } ${
                            template.id === "rest-day"
                              ? "bg-slate-50/70"
                              : "bg-white"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-900">
                                {template.label || template.name}
                              </p>
                              {template.isDefault && (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500 tabular-nums">
                              {hasScheduledTime
                                ? `${formatShiftTime(template.startTime, settingsDraft.shiftTimeFormat)} - ${formatShiftTime(template.endTime, settingsDraft.shiftTimeFormat)} · ${breakSummary}${netHoursSummary}`
                                : template.range || "No scheduled hours"}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {!template.isDefault && (
                              <button
                                type="button"
                                onClick={() =>
                                  onSetDefaultShiftTemplate(template.id)
                                }
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300"
                              >
                                Set Default
                              </button>
                            )}
                            {!template.protected && (
                              <button
                                type="button"
                                aria-label={`Delete ${template.label || template.name}`}
                                title="Delete preset"
                                onClick={() =>
                                  onDeleteShiftTemplate(template.id)
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 size={15} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="p-4 text-slate-500">
                      No shift templates configured.
                    </p>
                  )}
                </div>
                <form
                  onSubmit={addShiftPreset}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <h5 className="font-semibold uppercase tracking-wide text-slate-700">
                    Create New Shift Preset
                  </h5>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_0.7fr_0.7fr]">
                    <input
                      type="text"
                      aria-label="Shift name"
                      placeholder="Shift Name (e.g. Graveyard Operations)"
                      value={newShiftName}
                      onChange={(event) => setNewShiftName(event.target.value)}
                      required
                      maxLength={60}
                      className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                    <input
                      type="time"
                      aria-label="Shift start time"
                      value={newShiftStartTime}
                      onChange={(event) =>
                        setNewShiftStartTime(event.target.value)
                      }
                      required
                      className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                    <input
                      type="time"
                      aria-label="Shift end time"
                      value={newShiftEndTime}
                      onChange={(event) =>
                        setNewShiftEndTime(event.target.value)
                      }
                      required
                      className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-3 text-xs font-medium text-slate-700">
                      Unpaid Break (mins):
                      <input
                        type="number"
                        aria-label="Unpaid break duration in minutes"
                        min="0"
                        step="1"
                        value={newShiftBreakMinutes}
                        onChange={(event) =>
                          setNewShiftBreakMinutes(event.target.value)
                        }
                        required
                        className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-900"
                    >
                      <Plus size={14} aria-hidden="true" />
                      Add Preset
                    </button>
                  </div>
                </form>
              </div>
              <div
                id="settingsTabDeductions"
                className={
                  activeSettingsTab === "deductions"
                    ? "space-y-4 text-xs"
                    : "space-y-4 text-xs hidden"
                }
              >
                <div className="space-y-3">
                  {privateFinancialDataStatus !== "ready" && (
                    <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                      <i
                        className="fa-solid fa-lock mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      {privateFinancialDataStatus === "migration-required"
                        ? "Migrate your existing private financial data in General Preferences before editing contribution settings."
                        : "Private financial data is not available; retry cloud loading before editing contribution settings."}
                    </p>
                  )}
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="w-full">
                      <table className="w-full table-fixed border-collapse text-left">
                        <colgroup>
                          <col className="w-[20%]" />
                          <col className="w-[20%]" />
                          <col className="w-[15%]" />
                          <col className="w-[14%]" />
                          <col className="w-[14%]" />
                          <col className="w-[17%]" />
                        </colgroup>
                        <thead className="border-b border-slate-200 bg-slate-50">
                          <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            <th className="break-words py-2.5 pl-4 pr-3">
                              Deduction
                            </th>
                            <th className="break-words px-3 py-2.5">
                              Cutoff Schedule
                            </th>
                            <th className="break-words px-3 py-2.5">
                              Per Cutoff (₱)
                            </th>
                            <th className="break-words px-3 py-2.5 text-right">
                              10th Cutoff
                            </th>
                            <th className="break-words px-3 py-2.5 text-right">
                              25th Cutoff
                            </th>
                            <th className="whitespace-nowrap py-2.5 pl-3 pr-4 text-right">
                              Monthly Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {payrollContributions.map(
                            ({ id, label, manualAmountKey }) => {
                              const frequency = settingsDraft[`${id}Frequency`];
                              const isCustom = frequency === "custom";
                              const firstCutoffAmount = getDeductionAtCutoff(
                                id,
                                0,
                              );
                              const secondCutoffAmount = getDeductionAtCutoff(
                                id,
                                1,
                              );
                              const amountItem =
                                summaryMonthlyDeductions.items.find(
                                  (item) => item.id === id,
                                );
                              const perCutoffAmount =
                                settingsDraft.payrollDeductionMode === "manual"
                                  ? Number(settingsDraft[manualAmountKey]) || 0
                                  : (firstCutoffAmount + secondCutoffAmount) /
                                    2;
                              const contributionDetails = {
                                sss: {
                                  name: "SSS Contribution",
                                  description: "Social Security System",
                                },
                                philHealth: {
                                  name: "PhilHealth",
                                  description: "National Health Insurance",
                                },
                                pagIbig: {
                                  name: "Pag-IBIG",
                                  description: "Home Development Mutual Fund",
                                },
                              }[id];
                              return (
                                <tr
                                  key={id}
                                  className="transition-colors hover:bg-slate-50/70"
                                >
                                  <td className="break-words py-2.5 pl-4 pr-3">
                                    <div className="flex items-center">
                                      <div>
                                        <span className="block whitespace-nowrap font-semibold leading-tight text-slate-900">
                                          {contributionDetails.name || label}
                                        </span>
                                        <span className="mt-0.5 block text-[11px] leading-tight text-slate-400">
                                          {contributionDetails.description}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <select
                                      id={`${id}Frequency`}
                                      value={frequency}
                                      onChange={(event) =>
                                        updateDraft(
                                          `${id}Frequency`,
                                          event.target.value,
                                        )
                                      }
                                      disabled={
                                        privateFinancialDataStatus !== "ready"
                                      }
                                      className="h-8 w-full max-w-36 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none focus:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {Object.entries(
                                        payrollFrequencyLabels,
                                      ).map(([value, optionLabel]) => (
                                        <option key={value} value={value}>
                                          {optionLabel}
                                        </option>
                                      ))}
                                    </select>
                                    {frequency === "monthly" && (
                                      <select
                                        aria-label={`Apply ${label} monthly amount on cutoff`}
                                        value={
                                          settingsDraft[`${id}MonthlyCutoff`]
                                        }
                                        onChange={(event) =>
                                          updateDraft(
                                            `${id}MonthlyCutoff`,
                                            event.target.value,
                                          )
                                        }
                                        disabled={
                                          privateFinancialDataStatus !== "ready"
                                        }
                                        className="mt-1 h-7 w-full max-w-36 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <option value="10">10th cutoff</option>
                                        <option value="25">25th cutoff</option>
                                      </select>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    {isCustom ? (
                                      <span className="text-[11px] text-slate-400">
                                        Set per cutoff
                                      </span>
                                    ) : settingsDraft.payrollDeductionMode ===
                                      "manual" ? (
                                      <label className="relative block w-full max-w-28">
                                        <span
                                          className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[10px] text-slate-400"
                                          aria-hidden="true"
                                        >
                                          ₱
                                        </span>
                                        <input
                                          type="number"
                                          id={manualAmountKey}
                                          min="0"
                                          step="0.01"
                                          value={settingsDraft[manualAmountKey]}
                                          onChange={(event) =>
                                            updateDraft(
                                              manualAmountKey,
                                              event.target.value,
                                            )
                                          }
                                          disabled={
                                            privateFinancialDataStatus !==
                                            "ready"
                                          }
                                          aria-label={`${label} amount per cutoff`}
                                          className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-6 pr-2 font-mono text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                                        />
                                      </label>
                                    ) : (
                                      <output className="break-all font-mono text-xs font-semibold text-slate-700">
                                        {formatSummaryAmount(perCutoffAmount)}
                                      </output>
                                    )}
                                  </td>
                                  {[firstCutoffAmount, secondCutoffAmount].map(
                                    (amount, index) => {
                                      const cutoffKey =
                                        index === 0
                                          ? `${id}FirstCutoffAmount`
                                          : `${id}SecondCutoffAmount`;
                                      const cutoffLabel =
                                        index === 0 ? "10th" : "25th";
                                      return (
                                        <td
                                          key={cutoffKey}
                                          className="px-3 py-2.5 text-right"
                                        >
                                          {isCustom ? (
                                            <input
                                              type="number"
                                              id={cutoffKey}
                                              min="0"
                                              step="0.01"
                                              value={settingsDraft[cutoffKey]}
                                              onChange={(event) =>
                                                updateDraft(
                                                  cutoffKey,
                                                  event.target.value,
                                                )
                                              }
                                              disabled={
                                                privateFinancialDataStatus !==
                                                "ready"
                                              }
                                              aria-label={`${label} ${cutoffLabel} cutoff amount`}
                                              className="h-8 w-full max-w-24 rounded-lg border border-slate-200 bg-white px-1 text-right font-mono text-xs text-slate-800 outline-none focus:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                                            />
                                          ) : (
                                            <output className="break-all font-mono text-xs text-slate-700">
                                              {formatSummaryAmount(amount)}
                                            </output>
                                          )}
                                        </td>
                                      );
                                    },
                                  )}
                                  <td className="break-all py-2.5 pl-3 pr-4 text-right font-mono text-xs font-bold text-slate-900">
                                    {formatSummaryAmount(
                                      amountItem?.amount ||
                                        firstCutoffAmount + secondCutoffAmount,
                                    )}
                                  </td>
                                </tr>
                              );
                            },
                          )}
                        </tbody>
                        <tfoot className="border-t border-slate-200 bg-slate-50/95 text-xs">
                          <tr className="font-semibold text-slate-800">
                            <td colSpan={3} className="py-2.5 pl-4 pr-3">
                              Combined Statutory Deductions
                            </td>
                            <td className="break-all px-3 py-2.5 text-right font-mono">
                              {formatSummaryAmount(deductionCutoffs[0].total)}
                            </td>
                            <td className="break-all px-3 py-2.5 text-right font-mono">
                              {formatSummaryAmount(deductionCutoffs[1].total)}
                            </td>
                            <td className="break-all py-2.5 pl-3 pr-4 text-right font-mono text-emerald-700">
                              {formatSummaryAmount(
                                summaryMonthlyDeductions.total,
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                  {settingsDraft.payrollDeductionMode === "automatic" && (
                    <details className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                      <summary className="cursor-pointer font-semibold">
                        Planning estimates only · verify with payroll or HR
                      </summary>
                      <p className="mt-2">
                        Automatic mode uses simplified assumptions: SSS employee
                        share at 5% of a ₱5,000–₱35,000 salary-credit step;
                        PhilHealth at 2.5% of a ₱10,000–₱100,000 base; Pag-IBIG
                        at 1% up to ₱1,500 and 2% above that, capped at ₱10,000.
                        These estimates include employee shares only; employer
                        contributions and income tax are not included.
                      </p>
                    </details>
                  )}
                </div>
                <div className="space-y-3">
                  <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-600">
                        <i
                          className="fa-solid fa-circle-info"
                          aria-hidden="true"
                        />
                      </span>
                      <div>
                        <h5 className="text-xs font-bold text-slate-900">
                          {settingsDraft.payrollDeductionMode === "manual"
                            ? "Configured Payroll Basis Active"
                            : "Estimated Payroll Basis Active"}
                        </h5>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                          {settingsDraft.payrollDeductionMode === "manual"
                            ? "Exact peso figures entered above are deducted per scheduled cutoff and reflected immediately in semi-monthly net pay projections."
                            : "Estimated employee contributions are applied per scheduled cutoff and reflected immediately in semi-monthly net pay projections."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px]">
                      <span className="text-slate-500">
                        Employee share only · Tax excluded
                      </span>
                      <span className="shrink-0 font-semibold text-emerald-700">
                        {settingsDraft.payrollDeductionMode === "manual"
                          ? "Manual Override"
                          : "Auto-Estimate"}
                      </span>
                    </div>
                  </section>
                  <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                          <i
                            className="fa-solid fa-umbrella-beach"
                            aria-hidden="true"
                          />
                        </span>
                        <div>
                          <h5 className="font-bold text-slate-900">
                            Personal Leave Credits
                          </h5>
                          <p className="text-[11px] text-slate-500">
                            Available leave balances synced with leave filing.
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                        Total:{" "}
                        {["VL", "SL", "EL"].reduce(
                          (total, code) =>
                            total +
                            (Number(settingsDraft.settingsBalances[code]) || 0),
                          0,
                        )}{" "}
                        days
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {[
                        {
                          code: "VL",
                          label: "Vacation Leave",
                          color: "emerald",
                        },
                        { code: "SL", label: "Sick Leave", color: "rose" },
                        {
                          code: "EL",
                          label: "Emergency Leave",
                          color: "amber",
                        },
                      ].map((leave) => {
                        const balance =
                          Number(settingsDraft.settingsBalances[leave.code]) ||
                          0;
                        const colorClasses = {
                          emerald:
                            "border-emerald-200 bg-emerald-50 text-emerald-700",
                          rose: "border-rose-200 bg-rose-50 text-rose-700",
                          amber: "border-amber-200 bg-amber-50 text-amber-700",
                        }[leave.color];
                        return (
                          <div
                            key={leave.code}
                            className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5"
                          >
                            <label
                              className="mb-1.5 flex items-center gap-2 text-[11px] font-medium text-slate-600"
                              htmlFor={`settingLeave${leave.code}`}
                            >
                              <span
                                className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${colorClasses}`}
                              >
                                {leave.code}
                              </span>
                              {leave.label}
                            </label>
                            <div className="flex h-7 items-center justify-between rounded-lg border border-slate-200 bg-white">
                              <button
                                type="button"
                                aria-label={`Remove one ${leave.label} day`}
                                disabled={balance <= 0}
                                onClick={() =>
                                  updateDraft("settingsBalances", {
                                    ...settingsDraft.settingsBalances,
                                    [leave.code]: String(
                                      Math.max(0, balance - 1),
                                    ),
                                  })
                                }
                                className="h-full w-7 text-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                id={`settingLeave${leave.code}`}
                                value={
                                  settingsDraft.settingsBalances[leave.code]
                                }
                                onChange={(event) =>
                                  updateDraft("settingsBalances", {
                                    ...settingsDraft.settingsBalances,
                                    [leave.code]: event.target.value,
                                  })
                                }
                                min="0"
                                step="1"
                                className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-center text-xs font-semibold text-slate-800 outline-none"
                              />
                              <button
                                type="button"
                                aria-label={`Add one ${leave.label} day`}
                                onClick={() =>
                                  updateDraft("settingsBalances", {
                                    ...settingsDraft.settingsBalances,
                                    [leave.code]: String(balance + 1),
                                  })
                                }
                                className="h-full w-7 text-slate-500 hover:text-slate-800"
                              >
                                +
                              </button>
                            </div>
                            <p className="mt-0.5 text-center text-[10px] text-slate-400">
                              days
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
              </div>
              <div
                id="settingsTabGeneral"
                className={
                  activeSettingsTab === "general"
                    ? "space-y-5 text-xs"
                    : "space-y-5 text-xs hidden"
                }
              >
                <div className="text-xs">
                  <span className="font-semibold text-slate-700">
                    Primary Timezone:
                  </span>{" "}
                  <span className="text-slate-600">Manila (Asia/Manila)</span>
                </div>
                <section
                  className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4"
                  aria-labelledby="privateFinancialDataHeading"
                >
                  <div>
                    <h4
                      id="privateFinancialDataHeading"
                      className="font-bold text-teal-900"
                    >
                      Private financial data
                    </h4>
                    <p className="mt-1 text-[11px] leading-relaxed text-teal-800">
                      Financial data is encrypted by the server and associated
                      with your account. Your legacy vault passphrase is needed
                      only once to migrate existing encrypted data.
                    </p>
                  </div>
                  <p
                    className="text-[11px] font-semibold text-teal-900"
                    role="status"
                  >
                    {privateFinancialDataStatus === "ready" &&
                      (privateFinancialDataSyncing
                        ? "Private financial changes are syncing..."
                        : "Private financial data is loaded.")}
                    {privateFinancialDataStatus === "migration-required" &&
                      "Existing encrypted salary data must be migrated before it can be used."}
                    {privateFinancialDataStatus === "unavailable" &&
                      "Private financial storage is not configured on this server."}
                    {privateFinancialDataStatus === "error" &&
                      "Private financial data could not be loaded. Its contents are not available."}
                    {privateFinancialDataStatus === "loading" &&
                      "Loading private financial data..."}
                  </p>
                  {privateFinancialDataStatus === "error" && (
                    <button
                      type="button"
                      onClick={onReloadPrivateFinancialData}
                      className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50"
                    >
                      Retry loading
                    </button>
                  )}
                  {legacySalaryVaultAvailable &&
                    privateFinancialDataStatus === "migration-required" && (
                      <form
                        onSubmit={handleMigrateLegacyVault}
                        className="space-y-2 rounded-lg border border-teal-200 bg-white p-3"
                      >
                        <label className="block">
                          <span className="mb-1 block font-semibold text-slate-700">
                            Existing vault passphrase
                          </span>
                          <input
                            type="password"
                            autoComplete="current-password"
                            required
                            value={legacyVaultPassphrase}
                            onChange={(event) =>
                              setLegacyVaultPassphrase(event.target.value)
                            }
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={migrationLoading || !legacyVaultPassphrase}
                          className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                        >
                          {migrationLoading
                            ? "Migrating data..."
                            : "Migrate once"}
                        </button>
                      </form>
                    )}
                  {privateFinancialDataConflict && (
                    <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
                      <p className="text-[11px] text-rose-800">
                        Private financial data changed on another device. Reload
                        the latest data before saving.
                      </p>
                      <button
                        type="button"
                        onClick={onReloadPrivateFinancialData}
                        disabled={privateFinancialDataSyncing}
                        className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                      >
                        Reload private data
                      </button>
                    </div>
                  )}
                  {(migrationError || privateFinancialDataError) && (
                    <p className="text-[11px] text-rose-700" role="alert">
                      {migrationError || privateFinancialDataError}
                    </p>
                  )}
                </section>
                <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <h4 className="text-sm font-bold text-rose-800">
                    Privacy and account
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-rose-700">
                    Attendance, leave, expenses, and financial data sync to your
                    private cloud account. Financial data is encrypted on the
                    server and is not included in workspace records. Keep your
                    account credentials and exports private.
                  </p>
                  <button
                    type="button"
                    onClick={onDeleteAccount}
                    disabled={accountDeletionLoading}
                    className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {accountDeletionLoading
                      ? "Deleting account..."
                      : "Delete my account and data"}
                  </button>
                </section>
              </div>
              <div
                id="settingsTabHolidays"
                className={
                  activeSettingsTab === "holidays"
                    ? "space-y-5 text-xs"
                    : "space-y-5 text-xs hidden"
                }
              >
                <section className="space-y-3">
                  <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        role="group"
                        aria-label="Filter holidays by classification"
                        className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1"
                      >
                        {[
                          {
                            id: "ALL",
                            label: `All (${settingsDraft.holidays.length})`,
                          },
                          {
                            id: "REGULAR",
                            label: `Regular (${regularHolidayCount})`,
                          },
                          {
                            id: "SPECIAL",
                            label: `Special (${specialHolidayCount})`,
                          },
                        ].map((filter) => (
                          <button
                            key={filter.id}
                            type="button"
                            aria-pressed={holidayFilterType === filter.id}
                            onClick={() => setHolidayFilterType(filter.id)}
                            className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
                              holidayFilterType === filter.id
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>
                      <label className="relative block">
                        <Search
                          size={14}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                          aria-hidden="true"
                        />
                        <input
                          type="search"
                          value={holidaySearchQuery}
                          onChange={(event) =>
                            setHolidaySearchQuery(event.target.value)
                          }
                          placeholder="Filter holidays..."
                          aria-label="Filter holidays"
                          className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600 sm:w-52"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHolidayFormOpen((isOpen) => !isOpen)}
                      className="inline-flex h-9 items-center justify-center gap-2 self-end rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-100 sm:self-auto"
                    >
                      {holidayFormOpen ? (
                        <X size={14} aria-hidden="true" />
                      ) : (
                        <Plus size={14} aria-hidden="true" />
                      )}
                      {holidayFormOpen ? "Close Form" : "Add Holiday"}
                    </button>
                  </div>

                  <div
                    aria-hidden={!holidayFormOpen}
                    inert={!holidayFormOpen}
                    className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
                      holidayFormOpen
                        ? "pointer-events-auto opacity-100"
                        : "pointer-events-none opacity-0"
                    }`}
                    style={{
                      gridTemplateRows: holidayFormOpen ? "1fr" : "0fr",
                    }}
                  >
                    <div
                      className={`min-h-0 overflow-hidden transition-transform duration-300 ease-out motion-reduce:transition-none ${
                        holidayFormOpen ? "translate-y-0" : "-translate-y-2"
                      }`}
                    >
                      <form
                        onSubmit={handleAddHoliday}
                        className="grid grid-cols-1 gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/20 p-3 sm:grid-cols-[minmax(160px,1fr)_128px_minmax(250px,1.35fr)_auto] sm:items-center"
                      >
                        <input
                          id="customHolidayName"
                          type="text"
                          value={holidayName}
                          onChange={(event) =>
                            setHolidayName(event.target.value)
                          }
                          placeholder="Holiday name (e.g. Company Foundation Day)"
                          aria-label="Holiday name"
                          maxLength={80}
                          required
                          className="h-9 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                        />
                        <input
                          id="customHolidayDate"
                          type="date"
                          value={holidayDate}
                          onChange={(event) =>
                            setHolidayDate(event.target.value)
                          }
                          aria-label="Holiday date"
                          required
                          className="h-9 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                        />
                        <select
                          id="customHolidayType"
                          value={holidayType}
                          onChange={(event) =>
                            setHolidayType(event.target.value)
                          }
                          aria-label="New holiday classification"
                          className="h-9 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                        >
                          <option value="regular-holiday">
                            Regular (
                            {(
                              Number(settingsDraft.regularHolidayMultiplier) ||
                              2
                            ).toFixed(2)}
                            x)
                          </option>
                          <option value="special-non-working">
                            Special (
                            {(
                              Number(settingsDraft.specialHolidayMultiplier) ||
                              1.3
                            ).toFixed(2)}
                            x)
                          </option>
                          <option value="special-working">
                            Special Working (1.00x)
                          </option>
                        </select>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="submit"
                            className="h-9 rounded-xl bg-emerald-800 px-4 text-xs font-semibold text-white transition hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHolidayName("");
                              setHolidayDate("");
                              setHolidayFormOpen(false);
                            }}
                            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="max-h-[22rem] overflow-auto">
                      <table className="w-full min-w-[700px] border-collapse text-left">
                        <thead className="sticky top-0 z-10 bg-slate-50">
                          <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Holiday name</th>
                            <th className="px-4 py-3">Classification</th>
                            <th className="px-4 py-3">Multiplier</th>
                            <th className="px-4 py-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredHolidays.map((holiday) => {
                            const classification =
                              holiday.classification || holiday.type || "";
                            const classificationStyle =
                              classification === "Regular Holiday"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : classification === "Special Non-Working Day"
                                  ? "border-amber-200 bg-amber-50 text-amber-800"
                                  : classification === "Special Working Day"
                                    ? "border-teal-200 bg-teal-50 text-teal-800"
                                    : "border-slate-200 bg-slate-100 text-slate-500";
                            const multiplier =
                              classification === "Regular Holiday"
                                ? `${(Number(settingsDraft.regularHolidayMultiplier) || 2).toFixed(2)}x`
                                : classification === "Special Non-Working Day"
                                  ? `${(Number(settingsDraft.specialHolidayMultiplier) || 1.3).toFixed(2)}x`
                                  : classification === "Special Working Day"
                                    ? "1.00x"
                                    : "—";
                            const displayDate = new Date(
                              `${holiday.date}T00:00:00`,
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "2-digit",
                              year: "numeric",
                            });

                            return (
                              <tr
                                key={holiday.id}
                                className={`border-b border-slate-100 last:border-b-0 ${
                                  holiday.enabled
                                    ? "bg-white"
                                    : "bg-slate-50/70"
                                }`}
                              >
                                <td className="whitespace-nowrap px-4 py-2.5">
                                  {editingHolidayDateId === holiday.id ? (
                                    <input
                                      aria-label={`Update ${holiday.name} date`}
                                      type="date"
                                      value={holiday.date}
                                      autoFocus
                                      onBlur={() =>
                                        setEditingHolidayDateId(null)
                                      }
                                      onChange={(event) => {
                                        updateHolidayDate(
                                          holiday.id,
                                          event.target.value,
                                        );
                                        setEditingHolidayDateId(null);
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Escape") {
                                          setEditingHolidayDateId(null);
                                        }
                                      }}
                                      className="h-7 w-28 shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] text-slate-700 outline-none focus:border-emerald-600"
                                    />
                                  ) : holiday.dateConfigurable ||
                                    isCustomHoliday(holiday) ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingHolidayDateId(holiday.id)
                                      }
                                      aria-label={`Edit ${holiday.name} date`}
                                      title={`Edit ${holiday.name} date`}
                                      className="inline-flex h-7 w-28 shrink-0 items-center justify-start gap-1.5 rounded-lg border border-emerald-400 bg-slate-50 px-2.5 font-mono text-[10px] text-slate-700 transition hover:bg-emerald-50/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600"
                                    >
                                      <CalendarDays
                                        size={12}
                                        className="text-slate-400"
                                        aria-hidden="true"
                                      />
                                      {displayDate}
                                    </button>
                                  ) : (
                                    <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-[10px] text-slate-700">
                                      <CalendarDays
                                        size={12}
                                        className="text-slate-400"
                                        aria-hidden="true"
                                      />
                                      {displayDate}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`min-w-0 max-w-56 whitespace-normal break-words text-[11px] font-semibold leading-snug ${
                                        holiday.enabled
                                          ? "text-slate-800"
                                          : "text-slate-400"
                                      }`}
                                    >
                                      {holiday.name}
                                    </span>
                                    {isCustomHoliday(holiday) && (
                                      <>
                                        <span className="rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-medium text-indigo-700">
                                          Custom
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            deleteCustomHoliday(holiday.id)
                                          }
                                          aria-label={`Delete ${holiday.name}`}
                                          title={`Delete ${holiday.name}`}
                                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
                                        >
                                          <Trash2
                                            size={12}
                                            aria-hidden="true"
                                          />
                                        </button>
                                      </>
                                    )}
                                    {!isSupportedHolidayClassification(
                                      holiday,
                                    ) && (
                                      <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                                        Unavailable
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium ${classificationStyle}`}
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                    {classification ===
                                    "Special Non-Working Day"
                                      ? "Special Non-Working"
                                      : classification}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="rounded-md bg-emerald-50 px-2 py-1 font-mono text-[10px] font-semibold text-emerald-800">
                                    {multiplier}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center justify-end gap-2">
                                    <span
                                      className={`text-[10px] font-medium ${
                                        isSupportedHolidayClassification(
                                          holiday,
                                        ) && holiday.enabled
                                          ? "text-emerald-700"
                                          : "text-slate-400"
                                      }`}
                                    >
                                      {!isSupportedHolidayClassification(
                                        holiday,
                                      )
                                        ? "Unavailable"
                                        : holiday.enabled
                                          ? "Active"
                                          : "Off"}
                                    </span>
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={
                                        isSupportedHolidayClassification(
                                          holiday,
                                        ) && holiday.enabled
                                      }
                                      aria-label={`${holiday.enabled ? "Disable" : "Enable"} ${holiday.name}`}
                                      disabled={
                                        !isSupportedHolidayClassification(
                                          holiday,
                                        )
                                      }
                                      onClick={() =>
                                        updateDraft(
                                          "holidays",
                                          settingsDraft.holidays.map((item) =>
                                            item.id === holiday.id
                                              ? {
                                                  ...item,
                                                  enabled: !item.enabled,
                                                }
                                              : item,
                                          ),
                                        )
                                      }
                                      className={`relative h-5 w-9 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                        holiday.enabled
                                          ? "bg-emerald-700"
                                          : "bg-slate-300"
                                      }`}
                                    >
                                      <span
                                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                                          holiday.enabled
                                            ? "left-[18px]"
                                            : "left-0.5"
                                        }`}
                                      />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredHolidays.length === 0 && (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-4 py-10 text-center text-xs text-slate-500"
                              >
                                No holidays match these filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-2 text-[11px] font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={settingsDraft.holidayEligibilityConfirmed}
                        onChange={(event) =>
                          updateDraft(
                            "holidayEligibilityConfirmed",
                            event.target.checked,
                          )
                        }
                        className="h-4 w-4 shrink-0 accent-blue-600"
                      />
                      Confirm eligibility for worked special/non-regular holiday
                      pay
                    </label>
                    <p className="whitespace-nowrap text-[10px] font-medium">
                      <span className="text-emerald-700">
                        {regularHolidayCount} Regular
                      </span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className="text-amber-700">
                        {specialHolidayCount} Special
                      </span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className="text-slate-600">
                        {
                          settingsDraft.holidays.filter(
                            (holiday) =>
                              holiday.enabled &&
                              isSupportedHolidayClassification(holiday),
                          ).length
                        }{" "}
                        Active
                      </span>
                    </p>
                  </div>
                </section>
              </div>
            </div>
          </main>
        </div>
        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-slate-500">
            Changes immediately recalculate active cutoff payroll and calendar
            schedules.
          </p>
          <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              data-action="closeModal(&#x27;settingsModal&#x27;)"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={settingsSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {!settingsSaving && <Check size={16} aria-hidden="true" />}
              {settingsSaving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
