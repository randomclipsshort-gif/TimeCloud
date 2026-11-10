export const holidayClassifications = {
  regular: "Regular Holiday",
  specialNonWorking: "Special Non-Working Day",
  specialWorking: "Special Working Day",
  local: "Local Holiday",
  ordinary: "Ordinary Working Day",
};

export function getHolidayForDate(holidays, date, locality = "") {
  const normalizedLocality = locality.trim().toLocaleLowerCase();
  return holidays.find((holiday) => {
    if (holiday.enabled === false || holiday.date !== date) return false;
    if (!holiday.locality) return true;
    return normalizedLocality !== "" &&
      holiday.locality.trim().toLocaleLowerCase() === normalizedLocality;
  }) || null;
}

export function getHolidayClassification(holiday) {
  return holiday?.classification || holiday?.type || null;
}
