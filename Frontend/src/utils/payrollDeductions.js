function roundCurrency(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function getPositiveAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function estimateEmployeeContributions(monthlyGrossPay) {
  const grossPay = getPositiveAmount(monthlyGrossPay);
  if (grossPay === 0) {
    return { sss: 0, philHealth: 0, pagIbig: 0, total: 0 };
  }

  const sssSalaryCredit = Math.min(35_000, Math.max(5_000, Math.round(grossPay / 500) * 500));
  const philHealthSalaryBase = Math.min(100_000, Math.max(10_000, grossPay));
  const pagIbigSalaryBase = Math.min(10_000, grossPay);

  const sss = roundCurrency(sssSalaryCredit * 0.05);
  const philHealth = roundCurrency(philHealthSalaryBase * 0.025);
  const pagIbigRate = grossPay <= 1_500 ? 0.01 : 0.02;
  const pagIbig = roundCurrency(pagIbigSalaryBase * pagIbigRate);

  return {
    sss,
    philHealth,
    pagIbig,
    total: roundCurrency(sss + philHealth + pagIbig),
  };
}

export function calculatePayrollDeductions({
  mode,
  monthlyGrossPay,
  manualPerPaycheck = {},
  paychecksPerMonth = 2,
}) {
  if (mode === "manual") {
    const multiplier = Number.isSafeInteger(paychecksPerMonth) && paychecksPerMonth > 0
      ? paychecksPerMonth
      : 2;
    const sss = roundCurrency(getPositiveAmount(manualPerPaycheck.sss) * multiplier);
    const philHealth = roundCurrency(getPositiveAmount(manualPerPaycheck.philHealth) * multiplier);
    const pagIbig = roundCurrency(getPositiveAmount(manualPerPaycheck.pagIbig) * multiplier);
    return {
      sss,
      philHealth,
      pagIbig,
      total: roundCurrency(sss + philHealth + pagIbig),
    };
  }

  return estimateEmployeeContributions(monthlyGrossPay);
}
