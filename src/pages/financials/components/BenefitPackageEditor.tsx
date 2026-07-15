import React, { useState, useEffect } from 'react';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';
import SearchableDropdown from '../../../components/base/SearchableDropdown';
import { financialsService } from '../../../services/financialsService';

export const BenefitPackageEditor: React.FC = () => {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({
    id: undefined,
    journey_id: '',
    surrogate_id: '',
    signing_bonus: 2000,
    monthly_allowance: 400,
    embryo_transfer_fee: 1000,
    singleton_living_expense: 65000,
    multiples_living_expense: 10000,
    maternity_clothing: 1000,
    housekeeping_allowance: 1400,
    support_group_allowance: 100
  });

  useEffect(() => {
    loadPackages();
    loadLookups();
  }, []);

  const loadLookups = async () => {
    try {
      const jData = await financialsService.getJourneys();
      const uData = await financialsService.getUsers();
      setJourneys(jData || []);
      setUsers(uData || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.id) {
        // Editing existing package
        const { id, journey_id, surrogate_id, ...updates } = formData;
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
            journey_id: '',
            surrogate_id: '',
            signing_bonus: 2000,
            monthly_allowance: 400,
            embryo_transfer_fee: 1000,
            singleton_living_expense: 65000,
            multiples_living_expense: 10000,
            maternity_clothing: 1000,
            housekeeping_allowance: 1400,
            support_group_allowance: 100
          });
          setShowModal(true);
        }}>
          <i className="ri-add-line mr-2"></i> Create New Package
        </Button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{formData.id ? 'Edit Benefit Package' : 'Create New Package'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Journey ID</label>
                <SearchableDropdown
                  options={journeys.map(j => ({ id: j.id, name: j.case_number || `Journey ${j.id.substring(0, 8)}` }))}
                  value={formData.journey_id}
                  onChange={val => {
                    const selectedJourney = journeys.find(j => j.id === val);
                    console.log('Selected Journey in BenefitPackageEditor:', selectedJourney);
                    console.log('Gestational Carrier (Surrogate) ID for this journey:', selectedJourney?.gestational_carrier_id || selectedJourney?.surrogate_id);
                    setFormData({ 
                      ...formData, 
                      journey_id: val,
                      surrogate_id: selectedJourney?.gestational_carrier_id || selectedJourney?.surrogate_id || ''
                    });
                  }}
                  placeholder="Select Journey"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Surrogate ID</label>
                <SearchableDropdown
                  options={users
                    .filter(u => {
                      if (formData.journey_id) {
                        const j = journeys.find(jx => jx.id === formData.journey_id);
                        return u.id === (j?.gestational_carrier_id || j?.surrogate_id);
                      }
                      return u.role === 'gestationalCarrier' || u.role === 'surrogate';
                    })
                    .map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}` }))}
                  value={formData.surrogate_id}
                  onChange={val => setFormData({ ...formData, surrogate_id: val })}
                  placeholder="Select Surrogate"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Signing Bonus ($)</label>
                  <input type="number" required className="w-full border rounded p-2 text-black" 
                    value={formData.signing_bonus} onChange={e => setFormData({...formData, signing_bonus: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Monthly Allowance ($)</label>
                  <input type="number" required className="w-full border rounded p-2 text-black" 
                    value={formData.monthly_allowance} onChange={e => setFormData({...formData, monthly_allowance: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Base Compensation (Singleton) ($)</label>
                  <input type="number" required className="w-full border rounded p-2 text-black" 
                    value={formData.singleton_living_expense} onChange={e => setFormData({...formData, singleton_living_expense: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Multiples Fee (per additional) ($)</label>
                  <input type="number" required className="w-full border rounded p-2 text-black" 
                    value={formData.multiples_living_expense} onChange={e => setFormData({...formData, multiples_living_expense: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Embryo Transfer Fee ($)</label>
                  <input type="number" required className="w-full border rounded p-2 text-black" 
                    value={formData.embryo_transfer_fee} onChange={e => setFormData({...formData, embryo_transfer_fee: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Maternity Clothing ($)</label>
                  <input type="number" required className="w-full border rounded p-2 text-black" 
                    value={formData.maternity_clothing} onChange={e => setFormData({...formData, maternity_clothing: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Housekeeping Allowance ($)</label>
                  <input type="number" required className="w-full border rounded p-2 text-black" 
                    value={formData.housekeeping_allowance} onChange={e => setFormData({...formData, housekeeping_allowance: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Support Group Allowance ($)</label>
                  <input type="number" required className="w-full border rounded p-2 text-black" 
                    value={formData.support_group_allowance} onChange={e => setFormData({...formData, support_group_allowance: Number(e.target.value)})} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button color="blue" type="submit">Save Package</Button>
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
                        journey_id: pkg.journey_id,
                        surrogate_id: pkg.surrogate_id,
                        signing_bonus: pkg.signing_bonus,
                        monthly_allowance: pkg.monthly_allowance,
                        embryo_transfer_fee: pkg.embryo_transfer_fee,
                        singleton_living_expense: pkg.singleton_living_expense,
                        multiples_living_expense: pkg.multiples_living_expense,
                        maternity_clothing: pkg.maternity_clothing,
                        housekeeping_allowance: pkg.housekeeping_allowance,
                        support_group_allowance: pkg.support_group_allowance
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
