import React, { useState, useEffect, useMemo } from 'react';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';
import SearchableDropdown from '../../../components/base/SearchableDropdown';
import { financialsService } from '../../../services/financialsService';
import { matchService } from '../../../services/matchService';
import { SurrogateBenefitPackagePdfEditor } from './SurrogateBenefitPackagePdfEditor';

export const BenefitPackageEditor: React.FC = () => {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const DEFAULT_DATA_FEES = {
    cancelled_cycle_fee: 500,
    dc_fee: 500,
    abortion_before_20wks_fee: 1500,
    abortion_after_20wks_fee: 3000,
    ectopic_fee: 500,
    cvs_amnio_fee: 500,
    hysteroscopy_fee: 500,
    cervical_cerclage_fee: 500,
    uterine_biopsy_fee: 500,
    loss_of_ovary_fee: 1500,
    loss_of_uterus_fee: 6000,
    csection_fee: 3000,
    bed_rest_childcare_per_week: 325,
    bed_rest_housekeeping_per_week: 75,
    relaxation_therapy_fee: 1000,
    breast_milk_per_week: 400,
    life_insurance_fee: 1200,
    partner_lost_wages_per_day: 150,
  };

  const [formData, setFormData] = useState<any>({
    id: undefined,
    surrogate_id: '',
    signing_bonus: 2000,
    monthly_allowance: 400,
    embryo_transfer_fee: 1000,
    singleton_living_expense: 65000,
    multiples_living_expense: 10000,
    maternity_clothing: 1000,
    housekeeping_allowance: 1400,
    support_group_allowance: 100,
    data: { ...DEFAULT_DATA_FEES },
  });

  useEffect(() => {
    loadPackages();
    loadLookups();
  }, []);

  const loadLookups = async () => {
    try {
      const [uData, mData] = await Promise.all([
        financialsService.getUsers().catch(() => []),
        matchService.getAllMatches().catch(() => [])
      ]);
      setUsers(uData || []);
      setMatches(mData || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadPackages = async () => {
    try {
      const data = await financialsService.getBenefitPackages();
      setPackages(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const surrogateOptions = useMemo(() => {
    const isSurrogateRole = (role: string) =>
      ['surrogate', 'gestationalcarrier', 'gestational carrier', 'gestational_carrier']
        .includes((role || '').toLowerCase().trim());

    // Map surrogate id -> intended parent name, so matched surrogates keep their context
    const matchLabels = new Map<string, string>();
    matches.forEach(m => {
      const gcId = m.gestationalCarrierId || m.gestational_carrier_id || m.surrogate_id;
      if (!gcId || matchLabels.has(gcId)) return;
      const ipUser = m.intendedParentData;
      const ipName = ipUser ? `${ipUser.first_name} ${ipUser.last_name}`.trim() : '';
      if (ipName) matchLabels.set(gcId, ipName);
    });

    const optionsMap = new Map<string, string>();

    // 1. Every surrogate in the system, matched or not
    users
      .filter(u => isSurrogateRole(u.role))
      .forEach(u => {
        const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || `Surrogate (${u.id.substring(0, 8)})`;
        const ipName = matchLabels.get(u.id);
        optionsMap.set(u.id, name + (ipName ? ` (Matched with ${ipName})` : ''));
      });

    // 2. Surrogates referenced by a match but missing from the users list
    matches.forEach(m => {
      const gcId = m.gestationalCarrierId || m.gestational_carrier_id || m.surrogate_id;
      if (!gcId || optionsMap.has(gcId)) return;
      const gcUser = m.gestationalCarrierData || users.find(u => u.id === gcId);
      const gcName = gcUser
        ? `${gcUser.first_name || ''} ${gcUser.last_name || ''}`.trim()
        : `Surrogate (${gcId.substring(0, 8)})`;
      const ipName = matchLabels.get(gcId);
      optionsMap.set(gcId, gcName + (ipName ? ` (Matched with ${ipName})` : ''));
    });

    return Array.from(optionsMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [matches, users]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.id) {
        // Editing existing package
        const { id, ...updates } = formData;
        await financialsService.updateBenefitPackage(id, updates);
      } else {
        // Creating new
        const { id, ...newPackage } = formData;
        await financialsService.createBenefitPackage(newPackage);
      }
      setShowModal(false);
      loadPackages();
    } catch (e) {
      console.error(e);
      alert('Error saving package. Check console for details.');
    }
  };

  const handleSendForSignature = async (id: string) => {
    try {
      await financialsService.sendPackageForSignature(id);
      loadPackages();
      alert('Package sent! Push notification dispatched to surrogate.');
    } catch (e) {
      console.error(e);
      alert('Error sending package.');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Surrogate Benefit Packages</h2>
        <Button color="blue" onClick={() => {
          setFormData({
            id: undefined,
            surrogate_id: '',
            signing_bonus: 2000,
            monthly_allowance: 400,
            embryo_transfer_fee: 1000,
            singleton_living_expense: 65000,
            multiples_living_expense: 10000,
            maternity_clothing: 1000,
            housekeeping_allowance: 1400,
            support_group_allowance: 100,
            data: { ...DEFAULT_DATA_FEES },
          });
          setShowModal(true);
        }}>
          <i className="ri-add-line mr-2"></i> Create New Package
        </Button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <i className="ri-file-text-line text-purple-600"></i>
                  {formData.id ? 'Edit Benefit Package PDF' : 'Create New Care Package PDF'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xl font-bold p-1 rounded-lg"
                >
                  <i className="ri-close-line"></i>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                    Select Surrogate
                  </label>
                  <SearchableDropdown
                    options={surrogateOptions}
                    value={formData.surrogate_id}
                    onChange={val => setFormData({ ...formData, surrogate_id: val })}
                    placeholder="Select Surrogate"
                    required
                  />
                </div>

                {/* Interactive PDF Document Layout with Inline Editable Amount Fields */}
                <SurrogateBenefitPackagePdfEditor
                  formData={formData}
                  setFormData={setFormData}
                  surrogateName={
                    surrogateOptions.find(o => o.id === formData.surrogate_id)?.name || ''
                  }
                />

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 sticky bottom-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-2 rounded-b-xl z-20">
                  <Button variant="outline" type="button" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button color="blue" type="submit" className="shadow-lg shadow-blue-500/20">
                    <i className="ri-save-line mr-1.5"></i> Save Package
                  </Button>
                </div>
              </form>
            </div>
        </div>
      )}

      {packages.length === 0 ? (
        <p className="text-gray-500">No benefit packages found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b dark:border-white/10">
                <th className="py-3 px-4 font-semibold text-gray-600">Surrogate</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Signing Bonus</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Monthly Allowance</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Living Expense (Singleton)</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Status</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className="border-b hover:bg-gray-50 dark:hover:bg-white/5">
                  <td className="py-3 px-4">
                    {pkg.users?.first_name} {pkg.users?.last_name}
                  </td>
                  <td className="py-3 px-4">${pkg.signing_bonus}</td>
                  <td className="py-3 px-4">${pkg.monthly_allowance}</td>
                  <td className="py-3 px-4">${pkg.singleton_living_expense}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      pkg.status === 'signed' ? 'bg-green-100 text-green-800' :
                      pkg.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {(pkg.status || 'draft').toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setFormData({
                        id: pkg.id,
                        surrogate_id: pkg.surrogate_id,
                        signing_bonus: pkg.signing_bonus,
                        monthly_allowance: pkg.monthly_allowance,
                        embryo_transfer_fee: pkg.embryo_transfer_fee,
                        singleton_living_expense: pkg.singleton_living_expense,
                        multiples_living_expense: pkg.multiples_living_expense,
                        maternity_clothing: pkg.maternity_clothing,
                        housekeeping_allowance: pkg.housekeeping_allowance,
                        support_group_allowance: pkg.support_group_allowance,
                        // Merge saved procedure fees from DB with defaults for any missing keys
                        data: { ...DEFAULT_DATA_FEES, ...(pkg.data || {}) },
                      });
                      setShowModal(true);
                    }}>Edit</Button>
                    {(pkg.status === 'draft' || !pkg.status) && (
                      <Button color="blue" size="sm" onClick={() => handleSendForSignature(pkg.id)}>
                        Send
                      </Button>
                    )}
                    {pkg.status === 'sent' && (
                      <Button color="gray" variant="outline" size="sm" onClick={() => handleSendForSignature(pkg.id)}>
                        Resend
                      </Button>
                    )}
                    {pkg.status === 'signed' && pkg.signature_url && (
                      <Button color="green" size="sm" onClick={() => window.open(pkg.signature_url, '_blank')}>
                        View Signature
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
