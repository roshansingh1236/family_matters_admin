import React, { useState } from 'react';

interface PdfEditorProps {
  formData: any;
  setFormData: (data: any) => void;
  surrogateName?: string;
}

export const SurrogateBenefitPackagePdfEditor: React.FC<PdfEditorProps> = ({
  formData,
  setFormData,
  surrogateName = ''
}) => {
  const [activePage, setActivePage] = useState<number | 'all'>('all');

  // Updates a top-level field (signing_bonus, monthly_allowance, etc.)
  const updateField = (field: string, val: number) => {
    setFormData({
      ...formData,
      [field]: val
    });
  };

  // Updates a field inside formData.data (procedure fees, etc.)
  const updateDataField = (field: string, val: number) => {
    setFormData({
      ...formData,
      data: {
        ...(formData.data || {}),
        [field]: val
      }
    });
  };

  const inputClass =
    'w-24 text-right font-black text-slate-900 dark:text-white bg-transparent outline-none focus:ring-2 focus:ring-purple-500 rounded px-1';
  const wrapClass =
    'inline-flex items-center gap-1 font-bold text-slate-900 dark:text-white bg-purple-50 dark:bg-purple-950/80 border border-purple-400 dark:border-purple-500 rounded px-2 py-0.5 shadow-sm';
  const dollarSign = <span className="text-purple-700 dark:text-purple-300 font-bold">$</span>;

  // Renders an editable input for a TOP-LEVEL formData field
  const renderAmountInput = (field: string, defaultValue: number) => (
    <span className={wrapClass}>
      {dollarSign}
      <input
        type="number"
        step="0.01"
        className={inputClass}
        value={formData[field] !== undefined ? formData[field] : defaultValue}
        onChange={(e) => updateField(field, Number(e.target.value))}
      />
    </span>
  );

  // Renders an editable input for a field inside formData.data
  const renderDataAmountInput = (field: string, defaultValue: number) => (
    <span className={wrapClass}>
      {dollarSign}
      <input
        type="number"
        step="0.01"
        className={inputClass}
        value={formData.data?.[field] !== undefined ? formData.data[field] : defaultValue}
        onChange={(e) => updateDataField(field, Number(e.target.value))}
      />
    </span>
  );

  const HeaderPage = ({ pageNum }: { pageNum: number }) => (
    <div className="flex justify-between items-start text-xs text-purple-800 dark:text-purple-300 font-medium mb-6 pb-2 border-b-2 border-purple-200 dark:border-purple-800">
      <div>
        <div className="font-bold text-sm text-purple-950 dark:text-purple-200">Family Matters Surrogacy, LLC</div>
        <div className="text-[11px] text-slate-600 dark:text-slate-400">8030 La Mesa Blvd #63, La Mesa, CA 91942</div>
        <a href="http://www.familymatterssurrogacy.com/" target="_blank" rel="noreferrer" className="underline text-purple-600 dark:text-purple-400 text-[11px]">
          http://www.familymatterssurrogacy.com/
        </a>
      </div>
      <div className="text-right">
        <span className="bg-purple-100 dark:bg-purple-900 px-2.5 py-1 rounded-md text-purple-900 dark:text-purple-200 text-xs font-bold shadow-sm">
          Page {pageNum} of 8
        </span>
      </div>
    </div>
  );

  const FooterPage = ({ pageNum }: { pageNum: number }) => (
    <div className="mt-8 pt-3 border-t-2 border-purple-200 dark:border-purple-800 text-center text-xs text-purple-700 dark:text-purple-300 flex justify-between items-center">
      <span className="text-[11px]">8030 La Mesa Blvd #63, La Mesa, CA 91942</span>
      <a href="http://www.familymatterssurrogacy.com/" target="_blank" rel="noreferrer" className="underline text-[11px]">
        www.familymatterssurrogacy.com
      </a>
      <span className="font-bold text-sm">{pageNum}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Page Navigation Toolbar */}
      <div className="flex items-center justify-between bg-purple-50 dark:bg-slate-900 p-3 rounded-xl border border-purple-200 dark:border-purple-800/80 sticky top-0 z-10 backdrop-blur-md shadow-sm">
        <div className="text-xs font-bold text-purple-950 dark:text-purple-200 flex items-center gap-2">
          <i className="ri-file-pdf-2-line text-xl text-purple-600"></i>
          <span>Official 8-Page Care Package PDF Editor (All Amounts Editable)</span>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActivePage('all')}
            className={`px-3 py-1 text-xs rounded-lg font-bold transition ${
              activePage === 'all'
                ? 'bg-purple-700 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-purple-100'
            }`}
          >
            All Pages
          </button>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setActivePage(num)}
              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition ${
                activePage === num
                  ? 'bg-purple-700 text-white font-bold shadow-md'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-purple-100'
              }`}
            >
              P.{num}
            </button>
          ))}
        </div>
      </div>

      {/* Document Pages Container */}
      <div className="space-y-8 bg-slate-200 dark:bg-slate-950 p-4 rounded-2xl border border-slate-300 dark:border-slate-800 max-h-[70vh] overflow-y-auto">

        {/* PAGE 1 */}
        {(activePage === 'all' || activePage === 1) && (
          <div className="bg-white dark:bg-slate-900 border-4 border-purple-300 dark:border-purple-800 rounded-xl p-8 shadow-xl text-slate-800 dark:text-slate-100">
            <HeaderPage pageNum={1} />

            <div className="text-center my-6">
              <h1 className="text-2xl font-black tracking-widest text-purple-950 dark:text-purple-200 uppercase border-b-2 border-purple-300 dark:border-purple-800 inline-block pb-1">
                SURROGATE BENEFIT
              </h1>
              <h2 className="text-xl font-bold tracking-widest text-purple-700 dark:text-purple-400 uppercase mt-1">
                CARE PACKAGE
              </h2>
            </div>

            <div className="my-4 text-base font-bold border-b-2 border-purple-950 dark:border-purple-400 pb-1 flex items-center gap-2">
              <span className="text-purple-950 dark:text-purple-300 uppercase tracking-wide">NAME:</span>
              <span className="text-slate-950 dark:text-white underline font-extrabold text-lg">
                {surrogateName || '[Selected Surrogate]'}
              </span>
            </div>

            <div className="space-y-6 text-sm">
              <div className="bg-purple-50/60 dark:bg-slate-800/60 p-4 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <div className="flex justify-between items-center font-extrabold text-base text-purple-950 dark:text-purple-200 border-b border-purple-200 dark:border-purple-700 pb-2 mb-2">
                  <span className="underline">GCA Signing Bonus:</span>
                  {renderAmountInput('signing_bonus', 2000)}
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                  Paid to the Gestational Carrier once legal is complete. If the Gestational Carrier (Surrogate) does not complete at least one transfer, these funds must be returned to the Intended Parent(s).
                </p>
              </div>

              <div className="bg-purple-50/60 dark:bg-slate-800/60 p-4 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <div className="flex justify-between items-center font-extrabold text-base text-purple-950 dark:text-purple-200 border-b border-purple-200 dark:border-purple-700 pb-2 mb-2">
                  <span className="underline">Monthly Expense Allowance:</span>
                  {renderAmountInput('monthly_allowance', 400)}
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed mb-2">
                  Monthly Allowance covers the Surrogates' expenses including, but not limited, to parking, phone, fax, notary, postage, meals, childcare, and vitamins (non Rx) and lost wages to attend IVF/OB appointments.
                </p>
                <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed mb-2">
                  Multiple pregnancies will have a monthly non-accountable of $500.00 due to the increased number of pregnancy appointments (starting the 1st of the month after the 16th week from the embryo transfer).
                </p>
                <p className="text-purple-800 dark:text-purple-300 text-xs italic font-semibold">
                  *Monthly allowance begins at the first of the month following completion of the legal contract and ends at one month post-delivery or termination of contract.
                </p>
              </div>

              <div className="bg-purple-50/60 dark:bg-slate-800/60 p-4 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <div className="flex justify-between items-center font-extrabold text-base text-purple-950 dark:text-purple-200 border-b border-purple-200 dark:border-purple-700 pb-2 mb-2">
                  <span className="underline">Embryo Transfer:</span>
                  {renderAmountInput('embryo_transfer_fee', 1000)}
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                  The Surrogate will receive this payment for a complete embryo transfer. This fee includes, but is not limited to, childcare, housekeeping and lost wages for the Surrogate and/or spouse.
                </p>
              </div>
            </div>

            <FooterPage pageNum={1} />
          </div>
        )}

        {/* PAGE 2 */}
        {(activePage === 'all' || activePage === 2) && (
          <div className="bg-white dark:bg-slate-900 border-4 border-purple-300 dark:border-purple-800 rounded-xl p-8 shadow-xl text-slate-800 dark:text-slate-100">
            <HeaderPage pageNum={2} />

            <div className="space-y-6 text-sm">
              <div className="flex justify-between items-center font-bold text-sm border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-purple-950 dark:text-purple-200 font-extrabold text-base underline">After Transfer Hotel Stay:</span>
                <span className="text-slate-900 dark:text-white font-extrabold">TBD</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 -mt-4">
                Hotel stay after embryo transfer – Maximum of $350.00 per night/2 night and $400.00 Food allowance while in hotel.
              </p>

              <div className="bg-purple-50/60 dark:bg-slate-800/60 p-4 rounded-xl border border-purple-200 dark:border-purple-800/60 space-y-3">
                <div className="flex justify-between items-center font-extrabold text-base text-purple-950 dark:text-purple-200 border-b border-purple-200 dark:border-purple-700 pb-2">
                  <span className="underline">Pregnancy Living Expenses:</span>
                  {renderAmountInput('singleton_living_expense', 65000)}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  Singleton pregnancy payment is made at the first of the month following the first ultrasound confirming a fetal heartbeat. Compensation is paid in 10 installments of $6,500.00 per month. In the event that the Surrogate Mother is confirmed pregnant by Beta HCG blood test and no fetal heartbeat is detected, she will receive a one-time compensation of $500.00.
                </p>
                <div className="text-xs space-y-2 text-slate-700 dark:text-slate-300 border-t border-purple-200 dark:border-purple-800 pt-3">
                  <p className="font-bold text-purple-950 dark:text-purple-200">All payments are subject to the restrictions set forth below:</p>
                  <ul className="list-disc pl-4 space-y-1.5 text-xs leading-relaxed">
                    <li>Should the Surrogate deliver on or after 32 weeks (or 30 weeks for multiples) from the date of the embryo transfer, she shall be entitled to the remaining balance herein (including any remaining balance of the multiples fee).</li>
                    <li>Should the Surrogate deliver or have a miscarriage or abortion on or after 24 weeks (or 22 weeks for multiples) from the date of the embryo transfer and prior to reaching 32 weeks (or 30 weeks for multiples)...</li>
                    <li>Should the Surrogate deliver or have a miscarriage or abortion on or after 18 weeks (for singleton or multiples)...</li>
                    <li>Should a miscarriage or a physician-recommended abortion occur prior to the Surrogate reaching the 18th week after embryo transfer...</li>
                  </ul>
                </div>
              </div>

              <div className="bg-purple-50/60 dark:bg-slate-800/60 p-4 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <div className="flex justify-between items-center font-extrabold text-base text-purple-950 dark:text-purple-200 border-b border-purple-200 dark:border-purple-700 pb-2 mb-2">
                  <span className="underline">Multiple Pregnancy Compensation:</span>
                  {renderAmountInput('multiples_living_expense', 10000)}
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                  In the event the surrogate becomes pregnant with more than one fetus, an additional living expense of $10,000.00 per additional fetus will be included. The multiple payment is made at the first of the month following the 18th week after the embryo transfer. Compensation is paid in $2,000.00 for 5 months subject to the restrictions above.
                </p>
              </div>
            </div>

            <FooterPage pageNum={2} />
          </div>
        )}

        {/* PAGE 3 */}
        {(activePage === 'all' || activePage === 3) && (
          <div className="bg-white dark:bg-slate-900 border-4 border-purple-300 dark:border-purple-800 rounded-xl p-8 shadow-xl text-slate-800 dark:text-slate-100">
            <HeaderPage pageNum={3} />

            <div className="space-y-4 text-xs">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="font-extrabold text-purple-950 dark:text-purple-200 text-base underline">Travel Reimbursement: TBD</span>
                <p className="text-slate-700 dark:text-slate-300 mt-1">Mileage: If the Surrogate travels more than 50 miles round-trip to perform her obligations, she shall receive mileage reimbursements starting at mile 51 at $.70 per mile.</p>
              </div>

              <div className="bg-purple-50/60 dark:bg-slate-800/60 p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <span className="font-bold text-purple-950 dark:text-purple-200 text-xs">Long-distance Travel: If surrogate travels by air or stays overnight:</span>
                <ul className="list-disc pl-4 mt-1.5 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  <li>Air Fare for the Surrogate (Companion if approved by agency).</li>
                  <li>Mileage is reimbursed at mile 51 round-trip at $.70 per mile.</li>
                  <li>Hotel Reimbursement: Maximum of $350.00 per night.</li>
                  <li>Group Transportation (rental car, Uber, Lyft or equivalent): Maximum of $100.00 per day including gasoline, parking, insurance and tolls.</li>
                  <li>Food Allowance: $100.00 per day ($175.00 per day if Surrogate has a companion).</li>
                  <li>Childcare Allowance: $100.00 per day.</li>
                </ul>
              </div>

              {/* Evaluation / Cancelled Cycle — now editable */}
              <div className="flex justify-between items-center bg-purple-50/60 dark:bg-slate-800/60 p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <div>
                  <span className="font-extrabold text-purple-950 dark:text-purple-200 text-sm underline">Evaluation / Cancelled Cycle:</span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">Mock cycle or cancelled transfer after progesterone injection start at no fault of Surrogate.</p>
                </div>
                {renderDataAmountInput('cancelled_cycle_fee', 500)}
              </div>

              {/* Maternity Clothing — top-level field */}
              <div className="bg-purple-50/60 dark:bg-slate-800/60 p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <div className="flex justify-between items-center font-extrabold text-sm text-purple-950 dark:text-purple-200 border-b border-purple-200 dark:border-purple-700 pb-1.5 mb-1.5">
                  <span className="underline">Maternity Clothing Allowance:</span>
                  {renderAmountInput('maternity_clothing', 1000)}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300">Paid on the first of the month following the 16th gestational week of pregnancy.</p>
              </div>

              {/* Invasive Procedures — all editable */}
              <div className="bg-purple-50/60 dark:bg-slate-800/60 p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <div className="flex justify-between items-center font-extrabold text-purple-950 dark:text-purple-200 text-sm mb-1.5 border-b border-purple-200 pb-1">
                  <span className="underline">Invasive Procedure(s):</span>
                  <span className="font-black text-xs text-slate-500 dark:text-slate-400 italic">Range — see below</span>
                </div>
                <p className="text-xs italic text-slate-600 dark:text-slate-400 mb-3">A doctor's note may be required to be reimbursed.</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between items-center gap-2">
                    <span>• D&C:</span>
                    {renderDataAmountInput('dc_fee', 500)}
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span>• Abortion (prior to 20 wks):</span>
                    {renderDataAmountInput('abortion_before_20wks_fee', 1500)}
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span>• Abortion (after 20 wks):</span>
                    {renderDataAmountInput('abortion_after_20wks_fee', 3000)}
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span>• Ectopic / Tubal Pregnancy:</span>
                    {renderDataAmountInput('ectopic_fee', 500)}
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span>• CVS / Amniocentesis:</span>
                    {renderDataAmountInput('cvs_amnio_fee', 500)}
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span>• Hysteroscopy:</span>
                    {renderDataAmountInput('hysteroscopy_fee', 500)}
                  </div>
                </div>
              </div>
            </div>

            <FooterPage pageNum={3} />
          </div>
        )}

        {/* PAGE 4 */}
        {(activePage === 'all' || activePage === 4) && (
          <div className="bg-white dark:bg-slate-900 border-4 border-purple-300 dark:border-purple-800 rounded-xl p-8 shadow-xl text-slate-800 dark:text-slate-100">
            <HeaderPage pageNum={4} />

            <div className="space-y-4 text-xs">
              {/* Continued invasive procedures */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs bg-purple-50/60 dark:bg-slate-800/60 p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <div className="flex justify-between items-center gap-2">
                  <span>• Cervical Cerclage:</span>
                  {renderDataAmountInput('cervical_cerclage_fee', 500)}
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span>• Uterine Biopsy:</span>
                  {renderDataAmountInput('uterine_biopsy_fee', 500)}
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span>• Loss of Ovary / Fallopian Tube(s):</span>
                  {renderDataAmountInput('loss_of_ovary_fee', 1500)}
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span>• Loss of Uterus:</span>
                  {renderDataAmountInput('loss_of_uterus_fee', 6000)}
                </div>
                <div className="col-span-2 flex justify-between items-center gap-2">
                  <span>• C-Section Delivery:</span>
                  {renderDataAmountInput('csection_fee', 3000)}
                </div>
              </div>

              {/* Bed Rest — now editable */}
              <div className="border border-purple-200 dark:border-purple-800/60 p-3.5 rounded-xl bg-purple-50/40 dark:bg-slate-800/40 space-y-3">
                <span className="font-extrabold text-purple-950 dark:text-purple-200 text-sm underline">Bed Rest / Activity Restriction: TBD</span>
                <div className="flex justify-between items-center text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <div className="flex items-center gap-2">
                    <span>Childcare Allowance per week:</span>
                    {renderDataAmountInput('bed_rest_childcare_per_week', 325)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Housekeeping per week:</span>
                    {renderDataAmountInput('bed_rest_housekeeping_per_week', 75)}
                  </div>
                </div>
                <ul className="list-disc pl-4 text-xs text-slate-700 dark:text-slate-300 space-y-1 pt-1">
                  <li>The Surrogate must provide receipts to the Agency to be eligible for reimbursement.</li>
                  <li>Maximum time benefits extend: 6 weeks after vaginal delivery, or 8 weeks after C-Section birth.</li>
                  <li>Not eligible for childcare expense during normal school/daycare hours.</li>
                  <li>Must make a disability claim (if applicable) and provide copy to Agency.</li>
                </ul>
              </div>

              {/* Relaxation Therapy — now editable */}
              <div className="flex justify-between items-center bg-purple-50/60 dark:bg-slate-800/60 p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <div>
                  <span className="font-extrabold text-purple-950 dark:text-purple-200 text-sm underline">Relaxation Therapy Package:</span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Pregnancy massage therapy, chiropractic, acupuncture, pedicures up to 6 weeks post-delivery (reimbursable with receipt).
                  </p>
                </div>
                {renderDataAmountInput('relaxation_therapy_fee', 1000)}
              </div>

              {/* Housekeeping Allowance — top-level field */}
              <div className="bg-purple-50/60 dark:bg-slate-800/60 p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <div className="flex justify-between items-center font-extrabold text-sm text-purple-950 dark:text-purple-200 border-b border-purple-200 dark:border-purple-700 pb-1.5 mb-1.5">
                  <span className="underline">Housekeeping Allowance:</span>
                  {renderAmountInput('housekeeping_allowance', 1400)}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300">Housekeeping Allowance $100.00 per week starting at gestational week 26 and ending upon delivery.</p>
              </div>

              {/* Support Group — top-level field */}
              <div className="bg-purple-50/60 dark:bg-slate-800/60 p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <div className="flex justify-between items-center font-extrabold text-sm text-purple-950 dark:text-purple-200 border-b border-purple-200 dark:border-purple-700 pb-1.5 mb-1.5">
                  <span className="underline">Support Group Meetings:</span>
                  <div className="flex items-center gap-1">
                    {renderAmountInput('support_group_allowance', 100)}
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">/month</span>
                  </div>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300">The Surrogate shall receive $100.00 for every month that she participates in support group meetings provided by the Agency.</p>
              </div>
            </div>

            <FooterPage pageNum={4} />
          </div>
        )}

        {/* PAGE 5 */}
        {(activePage === 'all' || activePage === 5) && (
          <div className="bg-white dark:bg-slate-900 border-4 border-purple-300 dark:border-purple-800 rounded-xl p-8 shadow-xl text-slate-800 dark:text-slate-100">
            <HeaderPage pageNum={5} />

            <div className="space-y-4 text-xs">
              {/* Breast Milk — now editable */}
              <div className="bg-purple-50/60 dark:bg-slate-800/60 p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/60 space-y-1">
                <div className="flex justify-between items-center font-extrabold text-sm text-purple-950 dark:text-purple-200">
                  <span className="underline">Breast Milk:</span>
                  <div className="flex items-center gap-1">
                    {renderDataAmountInput('breast_milk_per_week', 400)}
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">/ week</span>
                  </div>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  If Surrogate chooses to pump breastmilk and Intended Parent(s) accept, surrogate will be reimbursed per week plus pumping supplies (receipts required).
                </p>
              </div>

              {/* Life Insurance — now editable */}
              <div className="bg-purple-50/60 dark:bg-slate-800/60 p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/60 space-y-1">
                <div className="flex justify-between items-center font-extrabold text-sm text-purple-950 dark:text-purple-200">
                  <span className="underline">Life Insurance Policy:</span>
                  {renderDataAmountInput('life_insurance_fee', 1200)}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  Coverage policy of $500,000.00 for Surrogate and $150,000.00 for Intended Parent(s), plus Loss of Reproductive Organs Ryder. Applied for after legal completion.
                </p>
              </div>

              {/* Health Insurance — TBD, no amount to edit */}
              <div className="bg-purple-50/60 dark:bg-slate-800/60 p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/60 space-y-1">
                <div className="flex justify-between items-center font-extrabold text-sm text-purple-950 dark:text-purple-200">
                  <span className="underline">Health Insurance:</span>
                  <span className="font-bold text-slate-900 dark:text-white">TBD</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  Intended Parent(s) responsible for all policy costs (premiums, co-pays, deductibles, prescriptions). Uninsured surrogates enrolled in GAP policy.
                </p>
              </div>

              {/* Partner's Lost Wages — now editable */}
              <div className="bg-purple-50/60 dark:bg-slate-800/60 p-3.5 rounded-xl border border-purple-200 dark:border-purple-800/60 space-y-1">
                <div className="flex justify-between items-center font-extrabold text-sm text-purple-950 dark:text-purple-200">
                  <span className="underline">Partner's Lost Wages:</span>
                  <div className="flex items-center gap-1">
                    {renderDataAmountInput('partner_lost_wages_per_day', 150)}
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">/ day</span>
                  </div>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  Flat rate per day for Husband/Partner for: (i) Parentage court appearance (max 1 day), (ii) Embryo transfer (max 2 days), (iii) Invasive/hospitalization (max 2 days/occ), (iv) Vaginal birth (max 3 days) or C-section (max 5 days), and (v) Hysterectomy (max 2 days).
                </p>
              </div>
            </div>

            <FooterPage pageNum={5} />
          </div>
        )}

        {/* PAGE 6 */}
        {(activePage === 'all' || activePage === 6) && (
          <div className="bg-white dark:bg-slate-900 border-4 border-purple-300 dark:border-purple-800 rounded-xl p-8 shadow-xl text-slate-800 dark:text-slate-100">
            <HeaderPage pageNum={6} />

            <div className="space-y-4 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
              <p className="font-extrabold text-purple-950 dark:text-purple-200 text-sm underline">
                Please initial only ONE paragraph below (whichever applicable at the time of signing this agreement):
              </p>

              <div className="bg-purple-50/50 dark:bg-slate-800/50 p-4 rounded-xl border border-purple-200 dark:border-purple-800/60 space-y-2">
                <p className="font-extrabold text-slate-900 dark:text-white">a) UNEMPLOYED AT MATCH:</p>
                <p className="text-xs">
                  I hereby represent that at the time I submitted this Benefit Care Package to Family Matters Surrogacy, LLC, I WAS NOT EMPLOYED and am therefore not entitled to recover lost wages for physician ordered bed rest during pregnancy or after birth.
                </p>
                <div className="pt-2 text-right text-xs font-bold text-purple-900 dark:text-purple-300">Initials: ________________</div>
              </div>

              <div className="bg-purple-50/50 dark:bg-slate-800/50 p-4 rounded-xl border border-purple-200 dark:border-purple-800/60 space-y-2">
                <p className="font-extrabold text-slate-900 dark:text-white">b) EMPLOYED AT MATCH:</p>
                <p className="text-xs">
                  I hereby represent that at the time I submitted this Benefit Care Package to Family Matters Surrogacy, LLC, I WAS AND CONTINUED TO BE EMPLOYED and am therefore entitled to lost wage reimbursement pursuant to terms herein. Must submit at least 3 current paystubs.
                </p>
                <div className="pt-2 text-right text-xs font-bold text-purple-900 dark:text-purple-300">Initials: ________________</div>
              </div>

              <p className="text-xs italic text-slate-600 dark:text-slate-400 pt-2">
                *If Surrogate is self-employed, rate is agreed upon at match using prior year's taxes or hourly rate at time of contracts.
              </p>
            </div>

            <FooterPage pageNum={6} />
          </div>
        )}

        {/* PAGE 7 */}
        {(activePage === 'all' || activePage === 7) && (
          <div className="bg-white dark:bg-slate-900 border-4 border-purple-300 dark:border-purple-800 rounded-xl p-8 shadow-xl text-slate-800 dark:text-slate-100">
            <HeaderPage pageNum={7} />

            <div className="space-y-4 text-xs">
              <h3 className="font-extrabold text-purple-950 dark:text-purple-200 text-sm border-b-2 border-purple-200 dark:border-purple-800 pb-1.5">
                Surrogate Declarations & Medical Questionnaire
              </h3>

              <div className="space-y-3 text-xs">
                <div className="bg-purple-50/50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-purple-200">
                  <span className="font-bold text-slate-900 dark:text-white block mb-1">Maximum Fetuses Willing to Carry:</span>
                  <div className="flex gap-4 font-semibold text-slate-800 dark:text-slate-200">
                    <span>[X] Singleton</span>
                    <span>[X] Twins</span>
                    <span>[ ] Triplets</span>
                  </div>
                </div>

                <div className="bg-purple-50/50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-purple-200">
                  <span className="font-bold text-slate-900 dark:text-white block mb-1">Willing to undergo fetal reduction / termination / D&C for medical reason?</span>
                  <div className="flex gap-4 font-semibold text-slate-800 dark:text-slate-200">
                    <span>[X] Yes</span>
                    <span>[ ] No</span>
                  </div>
                </div>

                <div className="bg-purple-50/50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-purple-200">
                  <span className="font-bold text-slate-900 dark:text-white block mb-1">Travel Restrictions:</span>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    Surrogate understands she cannot travel outside of USA during agreement, nor outside California after 24th gestational week without prior physician & agency approval.
                  </p>
                </div>
              </div>
            </div>

            <FooterPage pageNum={7} />
          </div>
        )}

        {/* PAGE 8 */}
        {(activePage === 'all' || activePage === 8) && (
          <div className="bg-white dark:bg-slate-900 border-4 border-purple-300 dark:border-purple-800 rounded-xl p-8 shadow-xl text-slate-800 dark:text-slate-100">
            <HeaderPage pageNum={8} />

            <div className="space-y-4 text-xs text-slate-800 dark:text-slate-200">
              <div className="text-center font-black text-base text-purple-950 dark:text-purple-200 border-b-2 border-purple-200 dark:border-purple-800 pb-2">
                REVIEW AND SIGN BELOW
              </div>
              <p className="text-xs leading-relaxed">
                By signing below, I understand the terms and conditions of the Surrogate Benefit Care Package. The terms are in accordance with the policies written for the Surrogate Mother Program at Family Matters Surrogacy, LLC. Amounts stated are not subject to change once signed.
              </p>

              <div className="border-2 border-dashed border-purple-400 dark:border-purple-600 p-5 rounded-2xl space-y-4 bg-purple-50/40 dark:bg-slate-800/40">
                <div className="flex justify-between items-center border-b border-purple-200 pb-2">
                  <span className="font-bold text-slate-900 dark:text-white">Surrogate Legal Name:</span>
                  <span className="underline font-black text-sm text-purple-950 dark:text-purple-200">{surrogateName || '________________________'}</span>
                </div>
                <div className="flex justify-between items-center border-b border-purple-200 pb-2">
                  <span className="font-bold text-slate-900 dark:text-white">Spouse/Partner Legal Name:</span>
                  <span className="underline font-semibold text-xs text-slate-700 dark:text-slate-300">________________________</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 dark:text-white">Surrogate Digital Signature:</span>
                  <span className="italic font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900 px-3 py-1 rounded-lg border border-purple-300">[Ready for Digital Signature]</span>
                </div>
              </div>

              <div className="text-center pt-6 border-t-2 border-purple-200 dark:border-purple-800 mt-6">
                <div className="text-xl font-black text-purple-950 dark:text-purple-200 tracking-widest uppercase">
                  Family Matters Surrogacy
                </div>
                <div className="text-xs text-purple-700 dark:text-purple-400 italic font-medium mt-1">
                  Where creating families is what matters
                </div>
              </div>
            </div>

            <FooterPage pageNum={8} />
          </div>
        )}

      </div>
    </div>
  );
};

export default SurrogateBenefitPackagePdfEditor;
