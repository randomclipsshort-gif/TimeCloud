export function switchPayrollBasis(settings, payrollBasis) {
  if (payrollBasis === settings.payrollBasis) return settings;

  const workingDays = Number(settings.workingDaysFactor) || 26;
  if (payrollBasis === "monthly") {
    return {
      ...settings,
      payrollBasis,
      monthlySalary: String((Number(settings.dailyWage) || 0) * workingDays),
    };
  }

  const dailyWage = Number(settings.monthlySalary) / workingDays;
  return {
    ...settings,
    payrollBasis,
    dailyWage: Number.isFinite(dailyWage) ? String(dailyWage) : "",
  };
}
