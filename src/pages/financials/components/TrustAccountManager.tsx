import React, { useState, useEffect } from 'react';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';
import SearchableDropdown from '../../../components/base/SearchableDropdown';
import { financialsService } from '../../../services/financialsService';

export const TrustAccountManager: React.FC = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [ledgerAcc, setLedgerAcc] = useState<any>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    journey_id: '',
    amount: 0
  });

  useEffect(() => {
    loadAccounts();
    loadLookups();
  }, []);

  const loadLookups = async () => {
    try {
      const jData = await financialsService.getJourneys();
      setJourneys(jData || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAccounts = async () => {
    try {
      const data = await financialsService.getTrustAccounts();
      setAccounts(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await financialsService.addFunds(formData.journey_id, formData.amount);
      setShowModal(false);
      await loadAccounts();
      setFormData({ journey_id: '', amount: 0 });
    } catch (err: any) {
      alert(err.message || 'Error adding funds');
    }
  };

  const handleViewLedger = async (acc: any) => {
    try {
      setLedgerAcc(acc);
      const entries = await financialsService.getLedgerEntries(acc.journey_id);
      setLedgerEntries(entries);
    } catch (err: any) {
      alert(err.message || 'Error fetching ledger');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Parent Wallet (Trust) Accounts</h2>
        <Button color="blue" onClick={() => setShowModal(true)}>
          <i className="ri-add-line mr-2"></i> Add Funds
        </Button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold mb-4">Add Funds to Wallet</h3>
            <form onSubmit={handleAddFunds} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Journey ID</label>
                <SearchableDropdown
                  options={journeys.map(j => ({ id: j.id, name: `Journey ${j.id.substring(0, 8)}` }))}
                  value={formData.journey_id}
                  onChange={val => setFormData({ ...formData, journey_id: val })}
                  placeholder="Select Journey"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount ($)</label>
                <input type="number" required className="w-full border rounded p-2 text-black" 
                  value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button color="blue" type="submit">Add Funds</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <p className="text-gray-500">No wallet accounts found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b dark:border-white/10">
                <th className="py-3 px-4 font-semibold text-gray-600">Parent Name</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Total Funded</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Current Balance</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Min Balance Req.</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id} className="border-b hover:bg-gray-50 dark:hover:bg-white/5">
                  <td className="py-3 px-4">
                    {acc.users?.first_name} {acc.users?.last_name}
                  </td>
                  <td className="py-3 px-4">${acc.total_funded}</td>
                  <td className="py-3 px-4 font-bold ${acc.current_balance < acc.minimum_balance_required ? 'text-red-500' : 'text-green-600'}">
                    ${acc.current_balance}
                  </td>
                  <td className="py-3 px-4">${acc.minimum_balance_required}</td>
                  <td className="py-3 px-4">
                    <Button variant="outline" size="sm" onClick={() => handleViewLedger(acc)}>View Ledger</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ledger Modal */}
      {ledgerAcc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg w-full max-w-2xl shadow-xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Ledger: {ledgerAcc.users?.first_name} {ledgerAcc.users?.last_name}</h3>
              <button onClick={() => setLedgerAcc(null)} className="text-gray-500 hover:text-black dark:hover:text-white">✕</button>
            </div>
            
            <div className="overflow-y-auto flex-1">
              {ledgerEntries.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No ledger transactions found.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b dark:border-white/10">
                      <th className="py-2 px-3 font-semibold text-gray-600">Date</th>
                      <th className="py-2 px-3 font-semibold text-gray-600">Type</th>
                      <th className="py-2 px-3 font-semibold text-gray-600">Title</th>
                      <th className="py-2 px-3 font-semibold text-gray-600">Amount</th>
                      <th className="py-2 px-3 font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((entry) => (
                      <tr key={entry.id} className="border-b hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="py-2 px-3">{new Date(entry.created_at).toLocaleDateString()}</td>
                        <td className="py-2 px-3">{entry.type}</td>
                        <td className="py-2 px-3">{entry.title}</td>
                        <td className="py-2 px-3 font-bold ${entry.type === 'Deposit' ? 'text-green-600' : 'text-gray-800 dark:text-gray-200'}">
                          ${entry.amount}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            entry.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="flex justify-end mt-4 pt-4 border-t dark:border-white/10">
              <Button variant="outline" onClick={() => setLedgerAcc(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
