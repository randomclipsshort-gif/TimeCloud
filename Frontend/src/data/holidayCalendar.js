const phNationalHolidays2026 = [
  { id: "2026-new-years-day", date: "2026-01-01", name: "New Year's Day", classification: "Regular Holiday" },
  { id: "2026-chinese-new-year", date: "2026-02-17", name: "Chinese New Year", classification: "Special Non-Working Day" },
  { id: "2026-edsa-anniversary", date: "2026-02-25", name: "EDSA People Power Revolution Anniversary", classification: "Special Working Day" },
  { id: "2026-eid-al-fitr", date: "2026-03-20", name: "Eid'l Fitr", classification: "Regular Holiday", dateConfigurable: true, description: "The date is subject to the applicable separate official declaration." },
  { id: "2026-maundy-thursday", date: "2026-04-02", name: "Maundy Thursday", classification: "Regular Holiday" },
  { id: "2026-good-friday", date: "2026-04-03", name: "Good Friday", classification: "Regular Holiday" },
  { id: "2026-black-saturday", date: "2026-04-04", name: "Black Saturday", classification: "Special Non-Working Day" },
  { id: "2026-araw-ng-kagitingan", date: "2026-04-09", name: "Araw ng Kagitingan", classification: "Regular Holiday" },
  { id: "2026-labor-day", date: "2026-05-01", name: "Labor Day", classification: "Regular Holiday" },
  { id: "2026-eid-al-adha", date: "2026-05-27", name: "Eid'l Adha", classification: "Regular Holiday", dateConfigurable: true, description: "The date is subject to the applicable separate official declaration." },
  { id: "2026-independence-day", date: "2026-06-12", name: "Independence Day", classification: "Regular Holiday" },
  { id: "2026-ninoy-aquino-day", date: "2026-08-21", name: "Ninoy Aquino Day", classification: "Special Non-Working Day" },
  { id: "2026-national-heroes-day", date: "2026-08-31", name: "National Heroes Day", classification: "Regular Holiday" },
  { id: "2026-all-saints-day", date: "2026-11-01", name: "All Saints' Day", classification: "Special Non-Working Day" },
  { id: "2026-all-souls-day", date: "2026-11-02", name: "All Souls' Day", classification: "Special Non-Working Day" },
  { id: "2026-bonifacio-day", date: "2026-11-30", name: "Bonifacio Day", classification: "Regular Holiday" },
  { id: "2026-immaculate-conception", date: "2026-12-08", name: "Feast of the Immaculate Conception", classification: "Special Non-Working Day" },
  { id: "2026-christmas-eve", date: "2026-12-24", name: "Christmas Eve", classification: "Special Non-Working Day" },
  { id: "2026-christmas-day", date: "2026-12-25", name: "Christmas Day", classification: "Regular Holiday" },
  { id: "2026-rizal-day", date: "2026-12-30", name: "Rizal Day", classification: "Regular Holiday" },
  { id: "2026-last-day-of-year", date: "2026-12-31", name: "Last Day of the Year", classification: "Special Non-Working Day" },
];

// National baseline from Proclamation No. 1006, s. 2025. Eid dates are editable
// because their observance dates are subject to separate official declaration.
export const holidayCalendarByYear = {
  2026: phNationalHolidays2026,
};

export const statutoryHolidays2026 = phNationalHolidays2026;
