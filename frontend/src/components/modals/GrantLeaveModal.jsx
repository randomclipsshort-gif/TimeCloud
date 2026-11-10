import { useState } from "react";

export default function GrantLeaveModal({ open, balances, selectedDate }) {
  const [selectedLeaveType, setSelectedLeaveType] = useState("VL");

  return (
    <div
      id="grantLeaveModal"
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      style={{ display: open ? "flex" : "none" }}
    >
      <div className="bg-cardBg rounded-2xl border border-slate-200 w-full max-w-lg p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
          <h3 className="font-bold text-lg text-textMain flex items-center space-x-2">
            <i className="fa-solid fa-umbrella-beach text-amber-600"></i>
            <span>Grant Leave</span>
          </h3>
          <button
            type="button"
            aria-label="Close modal"
            data-action="closeModal(&#x27;grantLeaveModal&#x27;)"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
        <form data-submit-action="handleGrantLeaveSubmit(event)" className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="grantLeaveStartDate" className="block font-semibold text-slate-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                id="grantLeaveStartDate"
                name="grantLeaveStartDate"
                defaultValue={selectedDate}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800"
              />
            </div>
            <div>
              <label htmlFor="grantLeaveEndDate" className="block font-semibold text-slate-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                id="grantLeaveEndDate"
                name="grantLeaveEndDate"
                defaultValue={selectedDate}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-2">
              Select Leave Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                className={`relative cursor-pointer border-2 rounded-2xl p-3.5 flex flex-col items-center text-center transition ${
                  selectedLeaveType === "VL"
                    ? "border-indigo-600 bg-indigo-50/30 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="grantLeaveTypeSelect"
                  value="VL"
                  checked={selectedLeaveType === "VL"}
                  onChange={() => setSelectedLeaveType("VL")}
                  className="sr-only"
                />
                <span className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
                  <i className="fa-solid fa-umbrella-beach"></i>
                </span>
                <span className="font-bold text-slate-800 text-xs">Vacation Leave</span>
                <span className="text-[10px] text-slate-500 mt-0.5">VL</span>
                <span className="text-[10px] font-semibold text-amber-700 mt-2">
                  {balances.VL} days available
                </span>
              </label>
              <label
                className={`relative cursor-pointer border-2 rounded-2xl p-3.5 flex flex-col items-center text-center transition ${
                  selectedLeaveType === "SL"
                    ? "border-indigo-600 bg-indigo-50/30 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="grantLeaveTypeSelect"
                  value="SL"
                  checked={selectedLeaveType === "SL"}
                  onChange={() => setSelectedLeaveType("SL")}
                  className="sr-only"
                />
                <span className="w-8 h-8 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mb-2">
                  <i className="fa-solid fa-kit-medical"></i>
                </span>
                <span className="font-bold text-slate-800 text-xs">Sick Leave</span>
                <span className="text-[10px] text-slate-500 mt-0.5">SL</span>
                <span className="text-[10px] font-semibold text-sky-700 mt-2">
                  {balances.SL} days available
                </span>
              </label>
              <label
                className={`relative cursor-pointer border-2 rounded-2xl p-3.5 flex flex-col items-center text-center transition ${
                  selectedLeaveType === "EL"
                    ? "border-indigo-600 bg-indigo-50/30 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="grantLeaveTypeSelect"
                  value="EL"
                  checked={selectedLeaveType === "EL"}
                  onChange={() => setSelectedLeaveType("EL")}
                  className="sr-only"
                />
                <span className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-2">
                  <i className="fa-solid fa-kit-medical"></i>
                </span>
                <span className="font-bold text-slate-800 text-xs">Emergency Leave</span>
                <span className="text-[10px] text-slate-500 mt-0.5">EL</span>
                <span className="text-[10px] font-semibold text-rose-700 mt-2">
                  {balances.EL} days available
                </span>
              </label>
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              data-action="closeModal(&#x27;grantLeaveModal&#x27;)"
              className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white shadow-sm cursor-pointer"
            >
              Grant Leave
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
