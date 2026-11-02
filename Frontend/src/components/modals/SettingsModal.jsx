import React, { useEffect, useState } from "react";
import {
  getPayrollDeductionSettingsDefaults,
  payrollContributions,
  payrollFrequencyLabels,
} from "../../utils/payrollDeductions.js";

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
  payrollDeductions,
  earlyPunchWindowMinutes,
  lateGracePeriodMinutes,
  nightDifferential,
  onDeleteAccount,
  accountDeletionLoading,
  onSaveSettings,
  salaryVaultStatus,
  salaryVaultError,
  salaryVaultConflict,
  salaryVaultSyncing,
  onUnlockSalaryVault,
  onLockSalaryVault,
  onRotateSalaryVault,
  onReloadSalaryVault,
  onSettingsValidationError,
}) {
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayType, setHolidayType] = useState("special-non-working");
  const [holidayLocality, setHolidayLocality] = useState("");
  const [holidayDescription, setHolidayDescription] = useState("");
  const [vaultPassphrase, setVaultPassphrase] = useState("");
  const [vaultPassphraseConfirmation, setVaultPassphraseConfirmation] =
    useState("");
  const [vaultNextPassphrase, setVaultNextPassphrase] = useState("");
  const [vaultNextPassphraseConfirmation, setVaultNextPassphraseConfirmation] =
    useState("");
  const [rotationOpen, setRotationOpen] = useState(false);
  const [vaultActionLoading, setVaultActionLoading] = useState(false);
  const [vaultActionError, setVaultActionError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setSettingsDraft(null);
      setVaultPassphrase("");
      setVaultPassphraseConfirmation("");
      setVaultNextPassphrase("");
      setVaultNextPassphraseConfirmation("");
      setRotationOpen(false);
      setVaultActionError("");
      setSettingsSaving(false);
      return;
    }
    setSettingsDraft({
      holidays: holidays.map((holiday) => ({ ...holiday })),
      selectedLocality,
      holidayEligibilityConfirmed,
      dailyWage,
      dailyAllowance,
      overtimeMultiplier,
      ...getPayrollDeductionSettingsDefaults(payrollSettings),
      earlyPunchWindowMinutes,
      lateGracePeriodMinutes,
      nightDifferential,
      settingsBalances: { ...settingsBalances },
    });
  }, [open]);

  const updateDraft = (key, value) => {
    setSettingsDraft((current) => ({ ...current, [key]: value }));
  };

  const handleRotateVault = async (event) => {
    event.preventDefault();
    setVaultActionLoading(true);
    setVaultActionError("");
    try {
      await onRotateSalaryVault(
        vaultNextPassphrase,
        vaultNextPassphraseConfirmation,
      );
      setVaultNextPassphrase("");
      setVaultNextPassphraseConfirmation("");
      setRotationOpen(false);
    } catch (error) {
      setVaultActionError(
        error instanceof Error
          ? error.message
          : "Unable to change the salary-vault passphrase.",
      );
    } finally {
      setVaultActionLoading(false);
    }
  };

  const handleVaultSubmit = async (event) => {
    event.preventDefault();
    setVaultActionLoading(true);
    setVaultActionError("");
    try {
      const unlocked = await onUnlockSalaryVault(
        vaultPassphrase,
        vaultPassphraseConfirmation,
      );
      if (unlocked?.settings) {
        setSettingsDraft((current) => ({
          ...current,
          dailyWage: unlocked.settings.dailyWage,
          dailyAllowance: unlocked.settings.dailyAllowance,
          overtimeMultiplier: unlocked.settings.overtimeMultiplier,
          nightDifferential: unlocked.settings.nightDifferential,
          ...getPayrollDeductionSettingsDefaults(unlocked.settings),
        }));
      }
      setVaultPassphrase("");
      setVaultPassphraseConfirmation("");
    } catch (error) {
      setVaultActionError(
        error instanceof Error
          ? error.message
          : "Unable to unlock the encrypted salary vault.",
      );
    } finally {
      setVaultActionLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    const invalidAmount = payrollContributions.some(({ id, manualAmountKey }) => {
      const frequency = settingsDraft[`${id}Frequency`];
      const amountKeys = [];
      if (settingsDraft.payrollDeductionMode === "manual" && frequency !== "custom") {
        amountKeys.push(manualAmountKey);
      }
      if (frequency === "custom") {
        amountKeys.push(`${id}FirstCutoffAmount`, `${id}SecondCutoffAmount`);
      }
      return amountKeys.some((key) => {
        const amount = Number(settingsDraft[key]);
        return !Number.isFinite(amount) || amount < 0;
      });
    });
    if (invalidAmount) {
      onSettingsValidationError("Contribution amounts must be zero or greater.");
      return;
    }
    if (payrollContributions.some(({ id }) => {
      const frequency = settingsDraft[`${id}Frequency`];
      const monthlyCutoff = settingsDraft[`${id}MonthlyCutoff`];
      return !Object.hasOwn(payrollFrequencyLabels, frequency) ||
        (frequency === "monthly" && !["10", "25"].includes(String(monthlyCutoff)));
    })) {
      onSettingsValidationError("Choose a valid contribution frequency and monthly cutoff.");
      return;
    }
    setSettingsSaving(true);
    try {
      await onSaveSettings(settingsDraft);
    } catch {
      setVaultActionError("Settings could not be saved.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleLockVault = async () => {
    setVaultActionLoading(true);
    setVaultActionError("");
    try {
      if ((await onLockSalaryVault()) === false) return;
      setSettingsDraft((current) => ({
        ...current,
        dailyWage: "",
        dailyAllowance: "0",
        overtimeMultiplier: "1.25",
        nightDifferential: "10",
      }));
    } finally {
      setVaultActionLoading(false);
    }
  };

  const handleAddHoliday = (event) => {
    event.preventDefault();
    const typeDetails = {
      "regular-holiday": { classification: "Regular Holiday" },
      "special-non-working": { classification: "Special Non-Working Day" },
      "special-working": { classification: "Special Working Day" },
      "local-holiday": { classification: "Local Holiday" },
      "ordinary-working": { classification: "Ordinary Working Day" },
      "company-break": { classification: "Company Break" },
    }[holidayType];
    const name = holidayName.trim();
    const locality = holidayLocality.trim();
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
      (typeDetails.classification === "Local Holiday" && !locality) ||
      settingsDraft.holidays.some((holiday) => holiday.date === holidayDate)
    ) {
      if (!name || !validDate) {
        onSettingsValidationError("Enter a holiday name and a valid date.");
      } else if (!typeDetails) {
        onSettingsValidationError("Choose a valid holiday type.");
      } else if (typeDetails.classification === "Local Holiday" && !locality) {
        onSettingsValidationError("Enter the locality for a local holiday.");
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
        description: holidayDescription.trim(),
        locality: locality || undefined,
        ...typeDetails,
        enabled: true,
        custom: true,
      },
    ]);
    setHolidayName("");
    setHolidayDate("");
    setHolidayType("special-non-working");
    setHolidayLocality("");
    setHolidayDescription("");
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

  if (!settingsDraft) return null;

  return (
    <div
      id="settingsModal"
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      style={{ display: open ? "flex" : "none" }}
    >
      <div className="bg-cardBg rounded-2xl border border-slate-200 w-full max-w-3xl p-8 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 font-bold text-lg">
              <i className="fa-solid fa-gear"></i>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                System Configuration
              </span>
              <h3 className="font-extrabold text-xl text-textMain">
                Payroll &amp; Benefit Settings
              </h3>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close modal"
            data-action="closeModal(&#x27;settingsModal&#x27;)"
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
        <div
          role="tablist"
          aria-label="System configuration sections"
          className="mb-6 grid grid-cols-2 gap-2 border-b border-slate-200 pb-4 text-xs font-semibold sm:grid-cols-4"
        >
          {[
            {
              id: "general",
              label: "General Preferences",
              tabId: "tabBtnGeneral",
              panelId: "settingsTabGeneral",
            },
            {
              id: "earnings",
              label: "Earnings & Rates",
              tabId: "tabBtnEarnings",
              panelId: "settingsTabEarnings",
            },
            {
              id: "deductions",
              label: "Deductions & Leave",
              tabId: "tabBtnDeductions",
              panelId: "settingsTabDeductions",
            },
            {
              id: "holidays",
              label: "Manage Holidays",
              tabId: "tabBtnHolidays",
              panelId: "settingsTabHolidays",
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tab.tabId}
              aria-selected={activeSettingsTab === tab.id}
              aria-controls={tab.panelId}
              data-action={`switchSettingsTab('${tab.id}')`}
              className={`flex min-h-9 w-full min-w-0 items-center justify-center whitespace-normal break-words px-2 py-1.5 text-center leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${
                activeSettingsTab === tab.id
                  ? "rounded-xl bg-teal-600 text-white transition cursor-pointer shadow-xs"
                  : "rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div
          id="settingsTabEarnings"
          className={
            activeSettingsTab === "earnings"
              ? "space-y-6 text-xs"
              : "space-y-6 text-xs hidden"
          }
        >
          {activeSettingsTab === "earnings" && (
            <>
              <div className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                    <i className="fa-solid fa-money-bill-wave" aria-hidden="true" />
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-800">Earnings &amp; Rates</h4>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      Set the rates used for your local earnings estimates.
                      Salary settings are stored in the encrypted vault.
                    </p>
                  </div>
                </div>
                <span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-semibold ${
                  salaryVaultStatus === "unlocked"
                    ? "border-emerald-100 bg-white text-emerald-700"
                    : "border-amber-200 bg-white text-amber-800"
                }`}>
                  {salaryVaultStatus === "unlocked"
                    ? "Vault unlocked"
                    : salaryVaultStatus === "loading"
                      ? "Checking vault"
                      : salaryVaultStatus === "unavailable"
                        ? "Vault unavailable"
                        : salaryVaultStatus === "uninitialized"
                          ? "Vault setup needed"
                          : "Vault locked"}
                </span>
              </div>
              {salaryVaultStatus !== "unlocked" && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[11px] leading-relaxed text-amber-900">
                  <i className="fa-solid fa-lock mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    {salaryVaultStatus === "unavailable"
                      ? "Apply the pending Supabase migration to enable encrypted salary settings."
                      : salaryVaultStatus === "loading"
                        ? "Checking encrypted salary vault access."
                        : salaryVaultStatus === "uninitialized"
                          ? "Create your encrypted salary vault in General Preferences to edit these settings."
                          : "Unlock your encrypted salary vault in General Preferences to edit these settings."}
                  </span>
                </div>
              )}
              <section
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                aria-labelledby="earningsRatesHeading"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    <i className="fa-solid fa-sliders" aria-hidden="true" />
                  </span>
                  <div>
                    <h5 id="earningsRatesHeading" className="font-bold text-slate-800">
                      Pay rates
                    </h5>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Values apply to earnings calculations and estimates.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <label
                      className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                      htmlFor="settingBaseWage"
                    >
                      Daily Base Wage (₱)
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-slate-400">
                        ₱
                      </span>
                      <input
                        type="number"
                        id="settingBaseWage"
                        min="0"
                        step="0.01"
                        disabled={salaryVaultStatus !== "unlocked"}
                        value={settingsDraft.dailyWage}
                        onChange={(event) =>
                          updateDraft("dailyWage", event.target.value)
                        }
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-8 pr-3 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <label
                      className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                      htmlFor="settingDailyAllowance"
                    >
                      Company Allowance · Daily (₱)
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-slate-400">
                        ₱
                      </span>
                      <input
                        type="number"
                        id="settingDailyAllowance"
                        min="0"
                        step="0.01"
                        disabled={salaryVaultStatus !== "unlocked"}
                        value={settingsDraft.dailyAllowance}
                        onChange={(event) =>
                          updateDraft("dailyAllowance", event.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-8 pr-3 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <label
                      className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                      htmlFor="settingNightDiff"
                    >
                      Night Differential
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        id="settingNightDiff"
                        min="0"
                        step="0.1"
                        disabled={salaryVaultStatus !== "unlocked"}
                        value={settingsDraft.nightDifferential}
                        onChange={(event) =>
                          updateDraft("nightDifferential", event.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-400">
                        %
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <label
                      className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                      htmlFor="settingOtMultiplier"
                    >
                      Overtime Multiplier
                    </label>
                    <input
                      type="number"
                      id="settingOtMultiplier"
                      min="0.01"
                      step="0.05"
                      disabled={salaryVaultStatus !== "unlocked"}
                      value={settingsDraft.overtimeMultiplier}
                      onChange={(event) =>
                        updateDraft("overtimeMultiplier", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                      Overtime pay = hourly rate × overtime hours × this multiplier.
                    </p>
                  </div>
                </div>
              </section>
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[11px] leading-relaxed text-amber-900">
                <i className="fa-solid fa-circle-info mt-0.5 shrink-0" aria-hidden="true" />
                <p>
                  Holiday-pay estimates use the configured daily wage and
                  recorded hours. Confirm employee eligibility in Manage
                  Holidays; company-specific pay rules should be verified
                  separately.
                </p>
              </div>
            </>
          )}
        </div>
        <div
          id="settingsTabDeductions"
          className={
            activeSettingsTab === "deductions"
              ? "space-y-6 text-xs"
              : "space-y-6 text-xs hidden"
          }
        >
          <div className="flex flex-col gap-3 rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                <i className="fa-solid fa-wallet" aria-hidden="true" />
              </span>
              <div>
                <h4 className="font-bold text-slate-800">
                  Deductions &amp; Leave
                </h4>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Configure employee contributions and personal leave credits.
                  Estimates are planning guidance, not payroll advice.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {salaryVaultStatus !== "unlocked" && (
              <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                <i className="fa-solid fa-lock mt-0.5 shrink-0" aria-hidden="true" />
                {salaryVaultStatus === "unavailable"
                  ? "Apply the Supabase salary-vault migration to enable private contribution settings."
                  : "Unlock or create your encrypted salary vault in General Preferences to edit and sync contribution settings."}
              </p>
            )}
            <div className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,0.8fr)] sm:items-center">
              <div>
                <label
                  className="block font-bold text-slate-800"
                  htmlFor="payrollDeductionMode"
                >
                  Contribution amount source
                </label>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Choose estimates or enter amounts configured by your payroll
                  administrator.
                </p>
              </div>
              <select
                id="payrollDeductionMode"
                value={settingsDraft.payrollDeductionMode}
                onChange={(event) =>
                  updateDraft("payrollDeductionMode", event.target.value)
                }
                disabled={salaryVaultStatus !== "unlocked"}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="automatic">Automatic planning estimates</option>
                <option value="manual">Enter configured amounts</option>
              </select>
            </div>
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <i className="fa-solid fa-receipt" aria-hidden="true" />
                </span>
                <div>
                  <h5 className="font-bold text-slate-800">Employee contributions</h5>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Set a schedule and amount for each contribution.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
              {payrollContributions.map(({ id, label, manualAmountKey }) => {
                const frequency = settingsDraft[`${id}Frequency`];
                const isCustom = frequency === "custom";
                const usesMonthlyAmount =
                  frequency === "monthly" || frequency === "split_monthly";
                const amountLabel = usesMonthlyAmount
                  ? "Monthly amount"
                  : "Amount each cutoff";
                const monthlyAmount = payrollDeductions?.items?.find(
                  (item) => item.id === id,
                )?.amount;
                const automaticAmountLabel =
                  frequency === "custom"
                    ? "Configured total across cutoffs"
                    : "Estimated total across cutoffs";
                return (
                  <div
                    key={id}
                    className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-teal-200 hover:shadow-sm"
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {label} schedule
                        </span>
                        <select
                          id={`${id}Frequency`}
                          value={frequency}
                          onChange={(event) =>
                            updateDraft(`${id}Frequency`, event.target.value)
                          }
                          disabled={salaryVaultStatus !== "unlocked"}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {Object.entries(payrollFrequencyLabels).map(
                            ([value, optionLabel]) => (
                              <option key={value} value={value}>
                                {optionLabel}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      {settingsDraft.payrollDeductionMode === "manual" &&
                      !isCustom ? (
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {label} {amountLabel} (₱)
                          </span>
                          <input
                            type="number"
                            id={manualAmountKey}
                            min="0"
                            step="0.01"
                            value={settingsDraft[manualAmountKey]}
                            onChange={(event) =>
                              updateDraft(manualAmountKey, event.target.value)
                            }
                            disabled={salaryVaultStatus !== "unlocked"}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </label>
                      ) : settingsDraft.payrollDeductionMode === "automatic" ? (
                        <div>
                          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {automaticAmountLabel}
                          </span>
                          <output className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-semibold text-slate-800">
                            ₱{Number(monthlyAmount || 0).toFixed(2)}
                          </output>
                        </div>
                      ) : null}
                    </div>
                    {frequency === "monthly" && (
                      <label className="mt-3 block sm:max-w-xs">
                        <span className="mb-1 block font-semibold text-slate-700">
                          Apply monthly amount on cutoff
                        </span>
                        <select
                          id={`${id}MonthlyCutoff`}
                          value={settingsDraft[`${id}MonthlyCutoff`]}
                          onChange={(event) =>
                            updateDraft(
                              `${id}MonthlyCutoff`,
                              event.target.value,
                            )
                          }
                          disabled={salaryVaultStatus !== "unlocked"}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="10">10th cutoff</option>
                          <option value="25">25th cutoff</option>
                        </select>
                      </label>
                    )}
                    {isCustom && (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {[
                          [`${id}FirstCutoffAmount`, "First cutoff (10th)"],
                          [`${id}SecondCutoffAmount`, "Second cutoff (25th)"],
                        ].map(([key, cutoffLabel]) => (
                          <label key={key} className="block">
                            <span className="mb-1 block font-semibold text-slate-700">
                              {label} · {cutoffLabel} (₱)
                            </span>
                            <input
                              type="number"
                              id={key}
                              min="0"
                              step="0.01"
                              value={settingsDraft[key]}
                              onChange={(event) =>
                                updateDraft(key, event.target.value)
                              }
                              disabled={salaryVaultStatus !== "unlocked"}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[11px] leading-relaxed text-amber-900">
              <p className="flex items-center gap-2 font-semibold">
                <i className="fa-solid fa-circle-info" aria-hidden="true" />
                Planning estimates only; verify actual deductions with payroll or HR.
              </p>
              <p className="mt-2">
                Automatic mode uses simplified assumptions: SSS employee share
                at 5% of a ₱5,000–₱35,000 salary-credit step; PhilHealth at 2.5%
                of a ₱10,000–₱100,000 base; Pag-IBIG at 1% up to ₱1,500 and 2%
                above that, capped at ₱10,000. These built-in estimates may not
                match current official tables or your payroll basis. Verify
                actual deductions with payroll or HR. These estimates include
                employee shares only; employer contributions and income tax are
                not included or deducted from net pay.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3 text-xs font-semibold text-white">
              <span>Estimated employee contributions · both cutoffs</span>
              <span>₱{payrollDeductions.total.toFixed(2)}</span>
            </div>
          </div>
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <i className="fa-solid fa-umbrella-beach" aria-hidden="true" />
              </span>
              <div>
                <h5 className="font-bold text-slate-800">Personal Leave Credits</h5>
                <p className="mt-1 text-[11px] text-slate-500">
                  Set available balances in days. Changes update leave requests.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <label className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500" htmlFor="settingLeaveVL">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700">VL</span>
                  Vacation Leave
                </label>
                <input
                  type="number"
                  id="settingLeaveVL"
                  value={settingsDraft.settingsBalances.VL}
                  onChange={(event) =>
                    updateDraft("settingsBalances", {
                      ...settingsDraft.settingsBalances,
                      VL: event.target.value,
                    })
                  }
                  min="0"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <label className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500" htmlFor="settingLeaveSL">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-700">SL</span>
                  Sick Leave
                </label>
                <input
                  type="number"
                  id="settingLeaveSL"
                  value={settingsDraft.settingsBalances.SL}
                  onChange={(event) =>
                    updateDraft("settingsBalances", {
                      ...settingsDraft.settingsBalances,
                      SL: event.target.value,
                    })
                  }
                  min="0"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <label className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500" htmlFor="settingLeaveEL">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-700">EL</span>
                  Emergency Leave
                </label>
                <input
                  type="number"
                  id="settingLeaveEL"
                  value={settingsDraft.settingsBalances.EL}
                  onChange={(event) =>
                    updateDraft("settingsBalances", {
                      ...settingsDraft.settingsBalances,
                      EL: event.target.value,
                    })
                  }
                  min="0"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            <p className="flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50/70 p-3 text-[11px] leading-relaxed text-teal-800">
              <i className="fa-solid fa-circle-info mt-0.5 shrink-0" aria-hidden="true" />
              These balances update available credits when filing leave requests.
            </p>
          </section>
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
            <span className="font-semibold text-slate-700">Primary Timezone:</span>{" "}
            <span className="text-slate-600">Manila (Asia/Manila)</span>
          </div>
          <section
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            aria-labelledby="timekeepingRulesHeading"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <i className="fa-solid fa-clock" aria-hidden="true" />
              </span>
              <div>
                <h4
                  id="timekeepingRulesHeading"
                  className="font-bold text-slate-800"
                >
                  Timekeeping rules
                </h4>
                <p className="mt-1 text-[11px] text-slate-500">
                  Control when punches are available and how late attendance is
                  classified.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  className="mb-1 block font-semibold text-slate-700"
                  htmlFor="settingEarlyPunchWindow"
                >
                  Allow early Time In (minutes)
                </label>
                <input
                  type="number"
                  id="settingEarlyPunchWindow"
                  min="0"
                  max="120"
                  step="1"
                  value={settingsDraft.earlyPunchWindowMinutes}
                  onChange={(event) =>
                    updateDraft(
                      "earlyPunchWindowMinutes",
                      Math.min(120, Math.max(0, Number(event.target.value) || 0)),
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Time In opens this many minutes before the scheduled start.
                  Default: 15.
                </p>
              </div>
              <div>
                <label
                  className="mb-1 block font-semibold text-slate-700"
                  htmlFor="settingLateGracePeriod"
                >
                  Late grace period (minutes)
                </label>
                <input
                  type="number"
                  id="settingLateGracePeriod"
                  min="0"
                  max="120"
                  step="1"
                  value={settingsDraft.lateGracePeriodMinutes}
                  onChange={(event) =>
                    updateDraft(
                      "lateGracePeriodMinutes",
                      Math.min(120, Math.max(0, Number(event.target.value) || 0)),
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Changes Late status only, not punch eligibility. Default: 15.
                </p>
              </div>
            </div>
          </section>
          <section
            className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4"
            aria-labelledby="salaryVaultHeading"
          >
            <div>
              <h4 id="salaryVaultHeading" className="font-bold text-teal-900">
                Encrypted salary sync
              </h4>
              <p className="mt-1 text-[11px] leading-relaxed text-teal-800">
                A separate vault passphrase encrypts salary data in this browser
                before upload. It is never sent to Supabase or saved on this
                device. Use the same passphrase on each device. If you lose it
                and all unlocked devices, the vault cannot be recovered.
              </p>
            </div>
            <p
              className="text-[11px] font-semibold text-teal-900"
              role="status"
            >
              {salaryVaultStatus === "unlocked" &&
                (salaryVaultSyncing
                  ? "Encrypted salary changes are syncing or loading..."
                  : "Vault unlocked. Salary data is encrypted before cloud sync.")}
              {salaryVaultStatus === "locked" &&
                "Encrypted vault found. Unlock it to view or sync salary data."}
              {salaryVaultStatus === "uninitialized" &&
                "Create a vault to encrypt and sync existing salary settings and earnings."}
              {salaryVaultStatus === "unavailable" &&
                "The encrypted salary-vault table is not installed yet. Apply the pending Supabase migration before creating a vault."}
              {salaryVaultStatus === "loading" &&
                "Checking encrypted salary vault..."}
            </p>
            {salaryVaultStatus === "unlocked" ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleLockVault}
                    disabled={vaultActionLoading}
                    className="rounded-lg border border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 disabled:opacity-60"
                  >
                    Lock salary vault
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotationOpen((value) => !value)}
                    disabled={vaultActionLoading}
                    className="rounded-lg border border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 disabled:opacity-60"
                  >
                    Change vault passphrase
                  </button>
                </div>
                {rotationOpen && (
                  <form
                    onSubmit={handleRotateVault}
                    className="space-y-2 rounded-lg border border-teal-200 bg-white p-3"
                  >
                    <label className="block">
                      <span className="mb-1 block font-semibold text-slate-700">
                        New passphrase
                      </span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={12}
                        required
                        value={vaultNextPassphrase}
                        onChange={(event) =>
                          setVaultNextPassphrase(event.target.value)
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block font-semibold text-slate-700">
                        Confirm new passphrase
                      </span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={12}
                        required
                        value={vaultNextPassphraseConfirmation}
                        onChange={(event) =>
                          setVaultNextPassphraseConfirmation(event.target.value)
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={vaultActionLoading}
                      className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                    >
                      {vaultActionLoading
                        ? "Re-encrypting..."
                        : "Change and sync passphrase"}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              ["locked", "uninitialized"].includes(salaryVaultStatus) && (
                <form onSubmit={handleVaultSubmit} className="space-y-2">
                  <label className="block">
                    <span className="mb-1 block font-semibold text-slate-700">
                      Vault passphrase (at least 12 characters)
                    </span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                      value={vaultPassphrase}
                      onChange={(event) =>
                        setVaultPassphrase(event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                  </label>
                  {salaryVaultStatus === "uninitialized" && (
                    <label className="block">
                      <span className="mb-1 block font-semibold text-slate-700">
                        Confirm vault passphrase
                      </span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={12}
                        required
                        value={vaultPassphraseConfirmation}
                        onChange={(event) =>
                          setVaultPassphraseConfirmation(event.target.value)
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                      />
                    </label>
                  )}
                  <button
                    type="submit"
                    disabled={vaultActionLoading}
                    className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                  >
                    {vaultActionLoading
                      ? "Encrypting..."
                      : salaryVaultStatus === "locked"
                        ? "Unlock vault"
                        : "Create and sync encrypted vault"}
                  </button>
                </form>
              )
            )}
            {salaryVaultConflict && (
              <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
                <p className="text-[11px] text-rose-800">
                  A newer cloud vault revision exists. This device has not
                  overwritten it. Reloading discards this browser's unsaved
                  salary changes.
                </p>
                <button
                  type="button"
                  onClick={onReloadSalaryVault}
                  disabled={salaryVaultSyncing}
                  className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                >
                  Reload latest encrypted vault
                </button>
              </div>
            )}
            {(vaultActionError || salaryVaultError) && (
              <p className="text-[11px] text-rose-700" role="alert">
                {vaultActionError || salaryVaultError}
              </p>
            )}
          </section>
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <h4 className="text-sm font-bold text-rose-800">
              Privacy and account
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-rose-700">
              Attendance, leave, and expenses sync to your private cloud
              workspace. Salary contents in an initialized vault are encrypted
              client-side; older cloud salary fields are retained until a
              separately approved cleanup. Supabase administrators can access
              cloud workspace records and encrypted vault metadata, but should
              not be able to decrypt vault contents without your passphrase.
              Keep devices and exports private.
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
          <section
            className="space-y-5"
            aria-labelledby="manageHolidaysHeading"
          >
            <div className="flex flex-col gap-3 rounded-2xl border border-teal-100 bg-gradient-to-r from-teal-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                  <i className="fa-solid fa-calendar-days" aria-hidden="true" />
                </span>
                <div>
                  <h4
                    id="manageHolidaysHeading"
                    className="font-bold text-slate-800"
                  >
                    Manage Holidays
                  </h4>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    The 2026 national list is preloaded. Eid dates can be
                    revised when separately declared.
                  </p>
                </div>
              </div>
              <span className="w-fit rounded-full border border-teal-100 bg-white px-3 py-1 text-[10px] font-semibold text-teal-700">
                {`${settingsDraft.holidays.filter((holiday) => holiday.enabled).length} of ${settingsDraft.holidays.length} active`}
              </span>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <input
                type="checkbox"
                checked={settingsDraft.holidayEligibilityConfirmed}
                onChange={(event) =>
                  updateDraft(
                    "holidayEligibilityConfirmed",
                    event.target.checked,
                  )
                }
                className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600"
              />
              <span className="text-[11px] leading-relaxed text-amber-900">
                Confirm employee eligibility for unworked regular-holiday pay
                estimates
              </span>
            </label>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                <div>
                  <h5 className="text-xs font-bold text-slate-800">
                    Holiday calendar
                  </h5>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Update movable dates or turn holidays on and off.
                  </p>
                </div>
                <i className="fa-solid fa-calendar-check text-teal-600" aria-hidden="true" />
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto p-3">
                {settingsDraft.holidays.map((holiday) => (
                  <div
                    key={holiday.id}
                    className={`flex flex-col gap-3 rounded-xl border p-3 transition sm:flex-row sm:items-center sm:justify-between ${
                      holiday.enabled
                        ? "border-slate-200 bg-white"
                        : "border-slate-100 bg-slate-50"
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        holiday.enabled
                          ? "bg-teal-50 text-teal-700"
                          : "bg-slate-200 text-slate-400"
                      }`}>
                        <i className="fa-solid fa-calendar-day" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate font-semibold ${holiday.enabled ? "text-slate-800" : "text-slate-400"}`}
                        >
                          {holiday.name}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                          <span>{holiday.classification || holiday.type}</span>
                          {holiday.locality && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{holiday.locality}</span>
                            </>
                          )}
                        </span>
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 pt-2 sm:border-0 sm:pt-0">
                      {holiday.dateConfigurable ? (
                        <label className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                          <span>Date</span>
                          <input
                            aria-label={`Update ${holiday.name} date`}
                            type="date"
                            value={holiday.date}
                            onChange={(event) =>
                              updateHolidayDate(holiday.id, event.target.value)
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </label>
                      ) : (
                        <span className="rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] font-medium text-slate-600">
                          {holiday.date}
                        </span>
                      )}
                      <label className="flex cursor-pointer items-center gap-2">
                        <span className={`text-[10px] font-semibold ${
                          holiday.enabled ? "text-teal-700" : "text-slate-400"
                        }`}>
                          {holiday.enabled ? "Active" : "Off"}
                        </span>
                        <input
                          type="checkbox"
                          checked={holiday.enabled}
                          onChange={() =>
                            updateDraft(
                              "holidays",
                              settingsDraft.holidays.map((item) =>
                                item.id === holiday.id
                                  ? { ...item, enabled: !item.enabled }
                                  : item,
                              ),
                            )
                          }
                          aria-label={`${holiday.enabled ? "Disable" : "Enable"} ${holiday.name}`}
                          className="h-4 w-4 cursor-pointer accent-teal-600"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <form
              onSubmit={handleAddHoliday}
              className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm">
                  <i className="fa-solid fa-circle-plus" aria-hidden="true" />
                </span>
                <div>
                  <h5 className="text-xs font-bold text-slate-800">
                    Add a holiday
                  </h5>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Add a custom holiday to your calendar.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold text-slate-600">
                    Holiday name
                  </span>
                  <input
                    id="customHolidayName"
                    type="text"
                    value={holidayName}
                    onChange={(event) => setHolidayName(event.target.value)}
                    placeholder="e.g. Company anniversary"
                    maxLength={80}
                    required
                    className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold text-slate-600">
                    Date
                  </span>
                  <input
                    id="customHolidayDate"
                    type="date"
                    value={holidayDate}
                    onChange={(event) => setHolidayDate(event.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold text-slate-600">
                    Classification
                  </span>
                  <select
                    id="customHolidayType"
                    value={holidayType}
                    onChange={(event) => setHolidayType(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="regular-holiday">Regular Holiday</option>
                    <option value="special-non-working">
                      Special Non-Working Day
                    </option>
                    <option value="special-working">Special Working Day</option>
                    <option value="local-holiday">Local Holiday</option>
                    <option value="ordinary-working">Ordinary Working Day</option>
                    <option value="company-break">Company Break (Paid)</option>
                  </select>
                </label>
                {holidayType === "local-holiday" && (
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold text-slate-600">
                      Locality
                    </span>
                    <input
                      value={holidayLocality}
                      onChange={(event) => setHolidayLocality(event.target.value)}
                      placeholder="Required for local holidays"
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </label>
                )}
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[10px] font-semibold text-slate-600">
                    Description <span className="font-normal text-slate-400">(optional)</span>
                  </span>
                  <input
                    value={holidayDescription}
                    onChange={(event) => setHolidayDescription(event.target.value)}
                    placeholder="Add a note about this holiday"
                    maxLength={200}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </label>
              </div>
              <div className="flex justify-end border-t border-slate-200 pt-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                >
                  <i className="fa-solid fa-plus" aria-hidden="true" />
                  <span>Add holiday</span>
                </button>
              </div>
            </form>
          </section>
        </div>
        <div className="mt-6 space-y-4 border-t border-slate-200 pt-4 text-xs">
          <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 leading-relaxed text-slate-600">
            <i
              className="fa-solid fa-circle-info mt-0.5 shrink-0 text-teal-600"
              aria-hidden="true"
            />
            <span>
              Salary data syncs only while the encrypted vault is unlocked;
              other workspace changes sync after saving.
            </span>
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              data-action="closeModal(&#x27;settingsModal&#x27;)"
              className="rounded-xl bg-slate-100 px-5 py-2.5 font-medium text-slate-700 transition hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={settingsSaving}
              className="rounded-xl bg-teal-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {settingsSaving ? "Saving..." : "Save Configurations"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
