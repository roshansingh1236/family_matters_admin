import React, { useState, useEffect, useRef } from 'react';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';
import Badge from '../../../components/base/Badge';
import SearchableDropdown from '../../../components/base/SearchableDropdown';
import { financialsService } from '../../../services/financialsService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const IPInvoiceManager: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    journey_id: '',
    intended_parent_id: '',
    invoice_number: `INV-${Date.now()}`,
    agency_fee: 1000,
    trust_account_allocation: 50000,
    due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0], // +15 days
  });

  const invoiceRef = useRef<HTMLDivElement>(null);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);

  useEffect(() => {
    loadInvoices();
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

  const loadInvoices = async () => {
    try {
      const data = await financialsService.getIpInvoices();
      setInvoices(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      if (window.confirm('Mark this invoice as PAID? This will automatically top up the associated Trust Account.')) {
        await financialsService.markInvoicePaid(id);
        loadInvoices();
      }
    } catch (e) {
      console.error(e);
      alert('Error marking invoice as paid.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const totalAmount = Number(formData.agency_fee) + Number(formData.trust_account_allocation);
      await financialsService.createIpInvoice({
        ...formData,
        total_amount: totalAmount,
      });
      setShowModal(false);
      loadInvoices();
      setFormData({
        ...formData,
        invoice_number: `INV-${Date.now()}`,
      });
    } catch (e) {
      console.error(e);
      alert('Error creating invoice. Check console.');
    }
  };

  const generatePDF = async (invoice: any) => {
    setPreviewInvoice(invoice);
    // Wait for state to update and render
    setTimeout(async () => {
      if (invoiceRef.current) {
        const canvas = await html2canvas(invoiceRef.current, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${invoice.invoice_number}.pdf`);
        setPreviewInvoice(null);
      }
    }, 500);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Intended Parent Invoices</h2>
        <Button color="blue" onClick={() => setShowModal(true)}>
          <i className="ri-add-line mr-2"></i> Create Invoice
        </Button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold mb-4">Create IP Invoice</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Invoice Number</label>
                  <input type="text" required className="w-full border rounded p-2 text-black bg-gray-100" 
                    value={formData.invoice_number} readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Due Date</label>
                  <input type="date" required className="w-full border rounded p-2 text-black" 
                    value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Journey</label>
                <SearchableDropdown
                  options={journeys.map(j => ({ id: j.id, name: j.case_number || `Journey ${j.id.substring(0, 8)}` }))}
                  value={formData.journey_id}
                  onChange={val => {
                    const selectedJourney = journeys.find(j => j.id === val);
                    console.log('Selected Journey in IPInvoiceManager:', selectedJourney);
                    console.log('Intended Parent ID for this journey:', selectedJourney?.intended_parent_id || selectedJourney?.parent_id);
                    setFormData({ 
                      ...formData, 
                      journey_id: val,
                      intended_parent_id: selectedJourney?.intended_parent_id || selectedJourney?.parent_id || ''
                    });
                  }}
                  placeholder="Select Journey"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Intended Parent</label>
                <SearchableDropdown
                  options={users
                    .filter(u => {
                      if (formData.journey_id) {
                        const j = journeys.find(jx => jx.id === formData.journey_id);
                        return u.id === (j?.intended_parent_id || j?.parent_id);
                      }
                      return u.role === 'intendedParent';
                    })
                    .map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}` }))}
                  value={formData.intended_parent_id}
                  onChange={val => setFormData({ ...formData, intended_parent_id: val })}
                  placeholder="Select IP"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Agency Fee ($)</label>
                  <input type="number" required className="w-full border rounded p-2 text-black" 
                    value={formData.agency_fee} onChange={e => setFormData({...formData, agency_fee: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Trust Account Top-up ($)</label>
                  <input type="number" required className="w-full border rounded p-2 text-black" 
                    value={formData.trust_account_allocation} onChange={e => setFormData({...formData, trust_account_allocation: Number(e.target.value)})} />
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded mt-4">
                <p className="text-sm font-bold text-blue-900 text-right">
                  Total Invoice Amount: ${(Number(formData.agency_fee) + Number(formData.trust_account_allocation)).toLocaleString()}
                </p>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button color="blue" type="submit">Create Invoice</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Invoice Template for PDF Generation */}
      {previewInvoice && (
        <div className="fixed top-[-9999px] left-[-9999px]">
          <div ref={invoiceRef} className="bg-white p-10 w-[800px] text-black border shadow-lg">
            <div className="flex justify-between items-center mb-10 border-b pb-6">
              <div>
                <h1 className="text-4xl font-black text-rose-500">INVOICE</h1>
                <p className="text-gray-500 mt-2">Family Matters Agency</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">{previewInvoice.invoice_number}</p>
                <p className="text-gray-500">Due: {new Date(previewInvoice.due_date).toLocaleDateString()}</p>
              </div>
            </div>
            
            <div className="mb-10">
              <p className="text-gray-500 text-sm font-bold uppercase mb-2">Billed To:</p>
              <p className="font-bold text-lg">{previewInvoice.users?.first_name} {previewInvoice.users?.last_name}</p>
              <p>Journey ID: {previewInvoice.journey_id.substring(0, 8)}</p>
            </div>

            <table className="w-full mb-10 border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-800">
                  <th className="py-3 px-4 text-left font-bold">Description</th>
                  <th className="py-3 px-4 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b dark:border-white/10">
                  <td className="py-4 px-4">Agency Administration Fee</td>
                  <td className="py-4 px-4 text-right">${previewInvoice.agency_fee.toLocaleString()}</td>
                </tr>
                <tr className="border-b dark:border-white/10">
                  <td className="py-4 px-4">Trust Account Top-up Allocation</td>
                  <td className="py-4 px-4 text-right">${previewInvoice.trust_account_allocation.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-1/2">
                <div className="flex justify-between py-2 font-bold text-xl border-t-2 border-gray-800 mt-4">
                  <span>TOTAL DUE:</span>
                  <span className="text-rose-500">${previewInvoice.total_amount.toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div className="mt-20 text-center text-gray-400 text-sm border-t pt-6">
              Thank you for choosing Family Matters Agency.
            </div>
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <p className="text-gray-500">No invoices generated yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b dark:border-white/10">
                <th className="py-3 px-4 font-semibold text-gray-600">Invoice #</th>
                <th className="py-3 px-4 font-semibold text-gray-600">IP Name</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Due Date</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Total</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Status</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b hover:bg-gray-50 dark:hover:bg-white/5">
                  <td className="py-3 px-4 font-mono font-medium">{inv.invoice_number}</td>
                  <td className="py-3 px-4">
                    {inv.users?.first_name} {inv.users?.last_name}
                  </td>
                  <td className="py-3 px-4">{new Date(inv.due_date).toLocaleDateString()}</td>
                  <td className="py-3 px-4 font-bold">${inv.total_amount.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <Badge color={inv.status === 'PAID' ? 'green' : 'yellow'}>{inv.status}</Badge>
                  </td>
                  <td className="py-3 px-4 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => generatePDF(inv)}>
                      <i className="ri-download-2-line mr-1"></i> PDF
                    </Button>
                    {inv.status === 'PENDING' && (
                      <Button color="green" size="sm" onClick={() => handleMarkPaid(inv.id)}>
                        Mark Paid
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
