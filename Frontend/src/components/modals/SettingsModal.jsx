import React, { useEffect, useState } from "react";

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
          className="mb-6 grid grid-cols-2 gap-2 border-b border-slate-200 pb-4 text-xs font-semibold sm:grid-cols-3 lg:grid-cols-5"
        >
          {[
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
              id: "attendance",
              label: "Attendance & Timekeeping",
              tabId: "tabBtnAttendance",
              panelId: "settingsTabAttendance",
            },
            {
              id: "general",
              label: "General Preferences",
              tabId: "tabBtnGeneral",
              panelId: "settingsTabGeneral",
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
              className={`flex min-h-10 items-center justify-center text-center leading-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${
                activeSettingsTab === tab.id
                  ? "px-4 py-2 rounded-xl bg-teal-600 text-white transition cursor-pointer shadow-xs"
                  : "px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"
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
              ? "space-y-5 text-xs"
              : "space-y-5 text-xs hidden"
          }
        >
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Daily Base Wage (PHP)
              </label>
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
                placeholder="Enter daily wage"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Company Allowance (Daily) (₱)
              </label>
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Night Differential (%)
              </label>
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Overtime pay = hourly rate × overtime hours × this multiplier.
              </p>
            </div>
          </div>
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
            Holiday-pay estimates use the configured daily wage and recorded
            hours. Calculations run locally after unlocking the encrypted salary
            vault. Confirm eligibility below; company-specific pay rules must be
            verified separately.
          </p>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={settingsDraft.holidayEligibilityConfirmed}
              onChange={(event) =>
                updateDraft("holidayEligibilityConfirmed", event.target.checked)
              }
              className="h-4 w-4 accent-teal-600"
            />
            <span className="text-[11px] text-slate-700">
              Confirm employee eligibility for unworked regular-holiday pay
              estimates
            </span>
          </label>
        </div>
        <div
          id="settingsTabDeductions"
          className={
            activeSettingsTab === "deductions"
              ? "space-y-5 text-xs"
              : "space-y-5 text-xs hidden"
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                SSS Contribution (₱)
              </label>
              <input
                type="number"
                id="settingSss"
                placeholder="Not calculated"
                disabled
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                PhilHealth Contribution (₱)
              </label>
              <input
                type="number"
                id="settingPhilhealth"
                placeholder="Not calculated"
                disabled
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Pag-IBIG Contribution (₱)
              </label>
              <input
                type="number"
                id="settingPagibig"
                placeholder="Not calculated"
                disabled
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 font-medium"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Statutory deductions and withholding tax are not calculated or
            applied to this personal earnings estimate.
          </p>
          <div className="pt-4 border-t border-slate-100">
            <span className="font-bold text-slate-800 block mb-3">
              <i className="fa-solid fa-umbrella-beach text-teal-600 mr-1.5"></i>
              Personal Leave Credits
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Vacation Leave (VL)
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Sick Leave (SL)
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Emergency Leave (EL)
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>
          </div>
          <div className="p-4 bg-teal-50/50 border border-teal-100 rounded-2xl">
            <span className="font-bold text-teal-900 block mb-1">
              Leave Allocation &amp; Deduction Note
            </span>
            <span className="text-teal-700 text-[11px]">
              Configuring leave credits here dynamically updates available
              balances when filing leave requests across the system.
            </span>
          </div>
        </div>
        <div
          id="settingsTabAttendance"
          className={
            activeSettingsTab === "attendance"
              ? "space-y-5 text-xs"
              : "space-y-5 text-xs hidden"
          }
        >
          <div>
            <h4 className="font-bold text-slate-800">Timekeeping rules</h4>
            <p className="mt-1 text-[11px] text-slate-500">
              Control when punches are available and how late attendance is
              classified.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                className="block font-semibold text-slate-700 mb-1"
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
                className="block font-semibold text-slate-700 mb-1"
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
        </div>
        <div
          id="settingsTabGeneral"
          className={
            activeSettingsTab === "general"
              ? "space-y-5 text-xs"
              : "space-y-5 text-xs hidden"
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Workspace
              </label>
              <input
                type="text"
                value="Personal"
                readOnly
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 font-medium"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Primary Timezone
              </label>
              <select
                disabled
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-500 font-medium"
              >
                <option value="Asia/Manila">Manila (Asia/Manila)</option>
              </select>
            </div>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-800 block">
                Auto-Lock Inactive Sessions
              </span>
              <span className="text-slate-500 text-[11px]">
                Session expiration is managed by Supabase authentication.
              </span>
            </div>
            <input
              type="checkbox"
              disabled
              className="w-4 h-4 accent-teal-600 rounded cursor-not-allowed"
              aria-label="Session timeout managed by Supabase"
            />
          </div>
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
            className="space-y-3"
            aria-labelledby="manageHolidaysHeading"
          >
            <div>
              <h4
                id="manageHolidaysHeading"
                className="font-bold text-slate-800"
              >
                Manage Holidays
              </h4>
              <p className="mt-1 text-[11px] text-slate-500">
                The 2026 national list is preloaded. Eid dates can be revised
                when separately declared.
              </p>
            </div>
            <label className="block">
              <span className="mb-1 block font-semibold text-slate-700">
                Active locality (optional)
              </span>
              <input
                type="text"
                value={settingsDraft.selectedLocality}
                onChange={(event) =>
                  updateDraft("selectedLocality", event.target.value)
                }
                placeholder="Enter locality to display configured local holidays"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
              />
            </label>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {settingsDraft.holidays.map((holiday) => (
                <div
                  key={holiday.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span
                      className={`block truncate font-semibold ${holiday.enabled ? "text-slate-800" : "text-slate-400 line-through"}`}
                    >
                      {holiday.name}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">
                      {holiday.date} · {holiday.classification || holiday.type}
                      {holiday.locality ? ` · ${holiday.locality}` : ""}
                    </span>
                  </span>
                  {holiday.dateConfigurable && (
                    <input
                      aria-label={`Update ${holiday.name} date`}
                      type="date"
                      value={holiday.date}
                      onChange={(event) =>
                        updateHolidayDate(holiday.id, event.target.value)
                      }
                      className="w-32 shrink-0 rounded border border-slate-200 px-1.5 py-1 text-[10px]"
                    />
                  )}
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
                    className="h-4 w-4 shrink-0 cursor-pointer accent-teal-600"
                  />
                </div>
              ))}
            </div>
            <form
              onSubmit={handleAddHoliday}
              className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2"
            >
              <label className="sr-only" htmlFor="customHolidayName">
                Holiday name
              </label>
              <input
                id="customHolidayName"
                type="text"
                value={holidayName}
                onChange={(event) => setHolidayName(event.target.value)}
                placeholder="Holiday name"
                maxLength={80}
                required
                className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
              />
              <label className="sr-only" htmlFor="customHolidayDate">
                Holiday date
              </label>
              <input
                id="customHolidayDate"
                type="date"
                value={holidayDate}
                onChange={(event) => setHolidayDate(event.target.value)}
                required
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
              />
              <label className="sr-only" htmlFor="customHolidayType">
                Holiday classification
              </label>
              <select
                id="customHolidayType"
                value={holidayType}
                onChange={(event) => setHolidayType(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
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
              {holidayType === "local-holiday" && (
                <input
                  value={holidayLocality}
                  onChange={(event) => setHolidayLocality(event.target.value)}
                  placeholder="Locality (required)"
                  required
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
                />
              )}
              <input
                value={holidayDescription}
                onChange={(event) => setHolidayDescription(event.target.value)}
                placeholder="Description (optional)"
                maxLength={200}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
              />
              <button
                type="submit"
                className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-700 sm:col-span-2"
              >
                Add
              </button>
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
